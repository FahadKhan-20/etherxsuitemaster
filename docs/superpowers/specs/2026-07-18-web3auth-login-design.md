# Web3Auth Login Design
**Date:** 2026-07-18
**Branch:** master (worktree: polygon-integration)
**Status:** Approved — ready for implementation planning

---

## Context

EtherXMeet currently has two separate identity systems that don't talk to each other:

1. **Backend auth** (`backend/src/routes/auth.js`) — email/password with bcrypt hashing, JWT session tokens, plus a parallel Google OAuth flow via Passport (`backend/src/config/passport.js`, `AuthCallback.jsx`). Session state lives in `localStorage` (`utils/auth.js`) and is attached to every API call by `apiClient.js`.
2. **Wallet** (`frontend/src/context/WalletContext.jsx`) — used only for on-chain meeting-receipt features (`useMeetingContract`, `MeetingReceiptModal`, `ChainHUD`, `OnChainConfirmModal`). On login it either connects MetaMask, or auto-generates an embedded wallet by deriving a private key from `keccak256(userId + 'etherx')` and storing it encrypted in `localStorage`. That derivation is weak — anyone who knows a user's `userId` can derive their wallet key — and it's discononnected from login: the wallet exists independently of how the user authenticated.

The product's login page claims the app is "P2P and fully decentralized." A teammate (Fahad) questioned this with respect to the media layer; that turned out to be a false alarm — the media layer is already a genuine WebRTC P2P mesh (see `frontend/src/hooks/useWebRTC.js`), not Jitsi. This spec addresses a *different* gap: identity. Right now "decentralized" doesn't apply to how users prove who they are — that's a conventional server-side password database.

**Goal:** Replace the backend password system and the ad-hoc wallet derivation with [Web3Auth](https://web3auth.io)'s Plug and Play Modal SDK, which uses MPC (multi-party computation) key-sharding for non-custodial key generation tied to a social/email login — no password database, no single point of key custody.

---

## Architecture Overview

```
User Browser
  │
  ├── Web3Auth Modal SDK (@web3auth/modal)
  │     ├── Google          ─┐
  │     ├── Email OTP        │─ produces: idToken + verified profile (email, name, avatar)
  │     ├── Discord          │           + EIP-1193 provider (wraps into ethers signer/address)
  │     └── External wallet ─┘  (MetaMask, shown natively inside the Web3Auth modal)
  │
  ├── ethers.BrowserProvider(web3authProvider)
  │     └── signer, address  → same wallet used for on-chain meeting receipts
  │
  └── POST /api/auth/web3auth { idToken, walletAddress, email, name, avatar }
        └── Backend verifies idToken against Web3Auth JWKS,
            upserts User by walletAddress (or links by email for migration),
            returns our existing app JWT

Backend (Express REST)
  ├── /api/auth/web3auth  (new — replaces /register, /login, /google*, /forgot-password, /reset-password)
  ├── /api/auth/me        (unchanged)
  ├── /api/recordings     (unchanged — still reads req.user.id from our JWT)
  └── /api/livekit        (unchanged)

MongoDB
  └── User  — password/resetPassword* fields removed, walletAddress added (unique)
```

Everything downstream of "there is a valid app JWT in `localStorage`" — `apiClient.js`, `ProtectedRoute.jsx`, `utils/auth.js`, the recordings API — is unchanged. The swap is isolated to *how* that JWT gets minted.

---

## 1. Frontend — Web3Auth Integration

**New dependency:** `@web3auth/modal`, `@web3auth/base`, `@web3auth/ethereum-provider`

**New required env var:** `VITE_WEB3AUTH_CLIENT_ID` — obtained by the user from [dashboard.web3auth.io](https://dashboard.web3auth.io) (external signup, not something this implementation can automate). Chain config points at Polygon Amoy, reusing the existing `AMOY_RPC` / `AMOY_CHAIN_ID` constants from `WalletContext.jsx`.

**New file:** `frontend/src/context/Web3AuthContext.jsx`
- Initializes `Web3Auth` (Modal SDK) with `clientId` and `chainConfig` for Amoy. `web3AuthNetwork` follows the existing `VITE_NETWORK` env var already used for chain selection: `'sapphire_devnet'` when `VITE_NETWORK=localhost`, `'sapphire_mainnet'` when `VITE_NETWORK=mainnet` — same on/off switch the app already has, no new env var needed for this.
- Configures the modal to show exactly four login methods: Google, Email Passwordless, Discord, and "External Wallet" (MetaMask).
- Exposes: `login()`, `logout()`, `account`, `signer`, `provider`, `balance`, `isReady`, `isConnecting`, `connectError`, `userInfo` (email/name/avatar from Web3Auth).
- On successful login: wraps the Web3Auth EIP-1193 provider in `ethers.BrowserProvider`, derives the signer/address, then calls `POST /api/auth/web3auth` with the idToken + wallet address + profile to mint the app session (via `persistAuthSession` from `utils/auth.js`, unchanged).

**Replaces:** `WalletContext.jsx` — its exported shape (`account, chainId, balance, provider, signer, isConnecting, connectError, isReady, connect, disconnect`) is preserved so `WalletBanner`, `ChainHUD`, `OnChainConfirmModal`, `MeetingReceiptModal`, and `useMeetingContract` need no changes.

**Changed:**
- `Login.jsx` and `Register.jsx` collapse into a single sign-in screen with one "Sign in" button that opens the Web3Auth modal. No separate register step — first login upserts the account server-side.
- `AuthCallback.jsx` — **deleted**. Web3Auth's modal handles OAuth redirects internally; there's no `/auth/callback?token=...` round trip to manage anymore.

**Unchanged:** `utils/auth.js`, `apiClient.js`, `ProtectedRoute.jsx`, every page that calls `useWallet()`.

---

## 2. Backend — Auth Route Replacement

**New file:** `backend/src/utils/verifyWeb3AuthToken.js`
- Uses `jwks-rsa` to fetch Web3Auth's public JWKS and verify the `idToken`'s signature.
- Confirms the token's `wallets` claim contains the `walletAddress` the client asserts — prevents a client from claiming someone else's wallet address.
- Returns the verified `{ email, name, walletAddress }` or throws.

**`backend/src/routes/auth.js` — new route:**
```
POST /api/auth/web3auth
  body: { idToken, walletAddress, email, name, avatar }
  1. verifyWeb3AuthToken(idToken, walletAddress) — 401 on failure
  2. find User by walletAddress
       not found → find User by email (migration path for legacy password accounts)
         found  → link: set walletAddress on that record, drop any password field
         not found → create new User { name, email, walletAddress, avatar, authProvider }
  3. sign our existing app JWT (signToken(), unchanged)
  4. return { success: true, data: { token, user } }
```

**Deleted routes:** `/register`, `/login`, `/forgot-password`, `/reset-password/:token`, `/google`, `/google/callback`.
**Kept as-is:** `/me`, `/local-ip`.

**`backend/src/config/passport.js`** — deleted (no more Google Passport strategy).
**`backend/src/index.js`** — remove `passport.initialize()` and the `configurePassport()` call.

**Dependencies:** remove `bcryptjs`, `passport`, `passport-google-oauth20`, `@emailjs/nodejs` (only used for password-reset emails); add `jwks-rsa`.

---

## 3. Data Model

**`backend/src/models/User.js` changes:**
- Remove: `password`, `resetPasswordToken`, `resetPasswordExpires`.
- Add: `walletAddress` (String, unique, required, indexed).
- Keep `authProvider`, repurpose enum to `['google', 'email_passwordless', 'discord', 'wallet']` (drives a "Signed in with Google" style badge in Settings).
- Keep `googleId` for now (harmless leftover, not actively used) — flag as removable in a later cleanup pass since it's out of scope here.

**Migration path:** Existing password-based accounts are matched and linked by verified email on first Web3Auth login (see route logic above). `Recording.uploadedBy` references `User._id`, which doesn't change during linking, so recording history carries over with no data loss. Accounts that are never revisited simply become dormant rows — no active migration script needed since linking happens lazily on next login.

---

## Verification

Implementation is complete when:
1. A brand-new user can sign in via each of the four methods (Google, Email OTP, Discord, MetaMask) and lands on the dashboard with a working session.
2. An existing email/password account, when signed into via Web3Auth with the same email, links to the original `User._id` (verified via its existing recordings still showing up).
3. `POST /api/auth/web3auth` rejects a request whose `walletAddress` doesn't match the `idToken`'s `wallets` claim (401).
4. `grep -r "bcryptjs\|passport" backend/src/` returns no results.
5. `WalletBanner`, `ChainHUD`, `OnChainConfirmModal`, `MeetingReceiptModal` all render correctly with no code changes, sourcing their wallet state from the new `Web3AuthContext`.
6. `/login`, `/register`, `/forgot-password`, `/reset-password/:token`, `/google`, `/google/callback`, and `/auth/callback` (frontend route) all return 404 / are unreachable.

## Out of scope
- Rotating the exposed Pinata JWT in `frontend/.env` (flagged separately, not part of this change).
- Any change to the WebRTC media layer — already confirmed P2P, untouched by this spec.
- Removing the now-vestigial `googleId` field from `User` (noted above, left for a later cleanup).
