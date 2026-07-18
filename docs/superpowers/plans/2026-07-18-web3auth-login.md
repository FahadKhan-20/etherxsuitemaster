# Web3Auth Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace email/password auth + Google Passport + the derived embedded-wallet scheme with MetaMask Embedded Wallets (formerly Web3Auth) — one non-custodial MPC login that produces both identity and an on-chain wallet, via the `@web3auth/modal` React SDK.

**Architecture:** Frontend wraps the app in `Web3AuthProvider` + `QueryClientProvider` + `WagmiProvider` (the SDK's current React integration pairs with wagmi for chain/account state). `WalletContext.jsx` is rewritten as a thin adapter that composes the SDK's hooks + wagmi's hooks into the exact same shape (`account, signer, provider, chainId, balance, isConnecting, connectError`) its 10 existing consumers already destructure, so none of them need to change. Login collects a Web3Auth `idToken` + wallet address and exchanges them with a new backend endpoint for our existing app JWT — everything downstream of that JWT (`apiClient`, `ProtectedRoute`, recordings API) is unchanged.

**Tech Stack:** React 18 (Vite), `@web3auth/modal` (React SDK), `wagmi` + `@tanstack/react-query` (required peer stack for the SDK's React integration), `ethers` v6 (existing, kept for contract calls — bridged from wagmi's wallet client); Express 5, Mongoose, `jsonwebtoken` (existing), `jose` (new, for verifying Web3Auth's idToken against its JWKS).

## Global Constraints

- Every consumer of `useWallet()` (`VideoRoom.jsx`, `useWebRTC.js`, `useMeetingNFT.js`, `useMeetingContract.js`, `useEnsName.js`, `VerifiedChat.jsx`, `WalletBanner.jsx`, `TokenGateModal.jsx`, `ChainHUD.jsx`) must keep working with **zero changes** — the hook's returned field names and types must not change.
- No new automated test framework — this codebase has none (frontend or backend) outside the Hardhat/Chai contract tests, which this feature doesn't touch. Follow the existing convention: manual curl/browser verification, except for the one genuinely risky new piece of logic (JWT verification), which gets a real TDD cycle using Node's built-in `node:test` + `node:assert` (zero new dependencies).
- `web3AuthNetwork` follows the existing `VITE_NETWORK` env var (`localhost` → `sapphire_devnet`, `mainnet` → `sapphire_mainnet`) — no new env var for that switch.
- `VITE_WEB3AUTH_CLIENT_ID` must be obtained by the user from https://developer.metamask.io (external signup — cannot be automated). Tasks that need it will fail at runtime until it's filled in; that's expected and noted at the point it's needed.
- The Polygon Amoy chain (id 80002) must be added/confirmed as an allowed chain in the developer.metamask.io project dashboard for the Client ID in use — this is dashboard configuration, not code, and can't be pinned in this plan.
- Migration: an existing password-based `User` document is linked (not duplicated) when a Web3Auth login's verified email matches an existing `User.email`. `Recording.uploadedBy` references `User._id`, which is preserved by linking, so recording history is not lost.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/src/models/User.js` | Modify | Drop password/reset fields, add `walletAddress` |
| `backend/src/utils/verifyWeb3AuthToken.js` | Create | Verify idToken against Web3Auth JWKS via `jose` |
| `backend/src/utils/verifyWeb3AuthToken.test.js` | Create | `node:test` unit tests for the above |
| `backend/src/routes/auth.js` | Modify | Replace `/register`,`/login`,`/forgot-password`,`/reset-password`,`/google*` with `/web3auth` |
| `backend/src/config/passport.js` | Delete | No longer needed — Web3Auth handles Google |
| `backend/src/index.js` | Modify | Remove `passport.initialize()` / `configurePassport()` |
| `backend/package.json` | Modify | Remove `bcryptjs`, `passport`, `passport-google-oauth20`, `@emailjs/nodejs`; add `jose` |
| `frontend/package.json` | Modify | Add `@web3auth/modal`, `wagmi`, `@tanstack/react-query` |
| `frontend/.env` | Modify | Add `VITE_WEB3AUTH_CLIENT_ID` (placeholder for user to fill in) |
| `frontend/src/context/WalletContext.jsx` | Modify | Rewrite internals on Web3Auth + wagmi; keep `WalletProvider`/`useWallet` exports |
| `frontend/src/pages/Login.jsx` | Modify | Single Web3Auth sign-in trigger, drop password form |
| `frontend/src/pages/Register.jsx` | Delete | No separate signup step anymore |
| `frontend/src/pages/AuthCallback.jsx` | Delete | Web3Auth modal handles OAuth redirects internally |
| `frontend/src/pages/ResetPassword.jsx` | Delete | No password to reset |
| `frontend/src/App.jsx` | Modify | Remove Register/AuthCallback/ResetPassword routes |
| `frontend/src/utils/constants.js` | Modify | Remove `REGISTER`, `AUTH_CALLBACK`, `RESET_PASSWORD` route constants |
| `frontend/src/pages/Landing.jsx` | Modify | Logout calls wallet `logout()` too |
| `frontend/src/components/layout/TopBar.jsx` | Modify | Logout calls wallet `logout()` too |
| `frontend/src/pages/Join.jsx` | Modify | Logout calls wallet `logout()` too |

---

## Task 1: User Model — Drop Passwords, Add walletAddress

**Files:**
- Modify: `backend/src/models/User.js`
- Test: `backend/src/models/User.schema.check.js` (throwaway verification script, deleted at the end of the task)

- [ ] **Step 1: Write the verification script (fails against the current schema)**

Create `backend/src/models/User.schema.check.js`:

```javascript
const assert = require('node:assert');
const User = require('./User');

const paths = Object.keys(User.schema.paths);

assert.ok(!paths.includes('password'), 'password field should be removed');
assert.ok(!paths.includes('resetPasswordToken'), 'resetPasswordToken field should be removed');
assert.ok(!paths.includes('resetPasswordExpires'), 'resetPasswordExpires field should be removed');
assert.ok(paths.includes('walletAddress'), 'walletAddress field should exist');
assert.strictEqual(User.schema.path('walletAddress').options.unique, true, 'walletAddress must be unique');
assert.deepStrictEqual(
  User.schema.path('authProvider').enumValues.sort(),
  ['discord', 'email_passwordless', 'google', 'wallet'].sort(),
  'authProvider enum must match the four Web3Auth login methods',
);

console.log('User schema check: PASS');
```

- [ ] **Step 2: Run it — verify it fails**

Run: `cd backend && node src/models/User.schema.check.js`
Expected: `AssertionError` on the first `password` assertion (schema hasn't changed yet).

- [ ] **Step 3: Update the User schema**

Replace `backend/src/models/User.js` with:

```javascript
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    authProvider: {
      type: String,
      enum: ['google', 'email_passwordless', 'discord', 'wallet'],
      required: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model('User', userSchema);
```

- [ ] **Step 4: Run the check again — verify it passes**

Run: `cd backend && node src/models/User.schema.check.js`
Expected: `User schema check: PASS`

- [ ] **Step 5: Delete the throwaway check script and commit**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration
rm backend/src/models/User.schema.check.js
git add backend/src/models/User.js
git commit -m "refactor(backend): drop password fields from User model, add walletAddress"
```

---

## Task 2: verifyWeb3AuthToken Utility (TDD)

**Files:**
- Create: `backend/src/utils/verifyWeb3AuthToken.js`
- Create: `backend/src/utils/verifyWeb3AuthToken.test.js`

**Interfaces:**
- Produces: `async function verifyWeb3AuthToken(idToken, expectedWalletAddress, { clientId })` → resolves to `{ email, name, walletAddress }` on success; throws `Error` on any failure (bad signature, wrong audience, expired, wallet mismatch). Task 3's route handler depends on this exact signature and throw-on-failure behavior.

- [ ] **Step 1: Install `jose`**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration/backend
npm install jose
```

- [ ] **Step 2: Write the failing tests**

These tests exercise the claim-checking logic (`__testOnlyCheckClaims`) directly with a hand-built `{ payload }` object, rather than signing real tokens and running them through full JWKS signature verification — that path requires network access to Web3Auth's live JWKS endpoint and is covered separately by manual E2E verification in Task 10, which happens after a real login exists to test against.

Create `backend/src/utils/verifyWeb3AuthToken.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { verifyWeb3AuthToken } = require('./verifyWeb3AuthToken');

const WALLET_ADDRESS = '0xAbC1230000000000000000000000000000dEaD';
const CLIENT_ID = 'test-client-id';

function basePayload(overrides = {}) {
  return {
    email: 'user@example.com',
    name: 'Test User',
    wallets: [{ type: 'ethereum', address: WALLET_ADDRESS }],
    ...overrides,
  };
}

test('throws when the wallet address does not match the claimed address', async () => {
  await assert.rejects(
    () => verifyWeb3AuthToken.__testOnlyCheckClaims(
      { payload: basePayload({ aud: CLIENT_ID }) },
      '0x0000000000000000000000000000000000dEaD',
      CLIENT_ID,
    ),
    /wallet/i,
  );
});

test('throws when the audience does not match the configured client ID', async () => {
  await assert.rejects(
    () => verifyWeb3AuthToken.__testOnlyCheckClaims(
      { payload: basePayload({ aud: 'someone-elses-client-id' }) },
      WALLET_ADDRESS,
      CLIENT_ID,
    ),
    /audience/i,
  );
});

test('resolves with lowercased email/name/walletAddress on a well-formed payload', async () => {
  const result = await verifyWeb3AuthToken.__testOnlyCheckClaims(
    { payload: basePayload({ aud: CLIENT_ID }) },
    WALLET_ADDRESS.toUpperCase(),
    CLIENT_ID,
  );
  assert.strictEqual(result.email, 'user@example.com');
  assert.strictEqual(result.name, 'Test User');
  assert.strictEqual(result.walletAddress, WALLET_ADDRESS.toLowerCase());
});

test('matches the wallet address case-insensitively against the claim list', async () => {
  const result = await verifyWeb3AuthToken.__testOnlyCheckClaims(
    { payload: basePayload({ aud: CLIENT_ID, wallets: [{ type: 'ethereum', address: WALLET_ADDRESS.toUpperCase() }] }) },
    WALLET_ADDRESS.toLowerCase(),
    CLIENT_ID,
  );
  assert.strictEqual(result.walletAddress, WALLET_ADDRESS.toLowerCase());
});
```

- [ ] **Step 3: Run the tests — verify they fail**

Run: `cd backend && node --test src/utils/verifyWeb3AuthToken.test.js`
Expected: `Cannot find module './verifyWeb3AuthToken'` (file doesn't exist yet).

- [ ] **Step 4: Implement verifyWeb3AuthToken.js**

Create `backend/src/utils/verifyWeb3AuthToken.js`:

```javascript
const { createRemoteJWKSet, jwtVerify } = require('jose');

// Web3Auth issues from two different endpoints depending on login type.
const JWKS_BY_ISSUER = {
  'https://api-auth.web3auth.io': createRemoteJWKSet(new URL('https://api-auth.web3auth.io/jwks')),
  'https://authjs.web3auth.io': createRemoteJWKSet(new URL('https://authjs.web3auth.io/jwks')),
};

/**
 * Pure claim-checking logic, factored out so tests can exercise it without
 * hitting the network for real JWKS/signature verification.
 * @param {{ payload: object }} verified - result shape from jose's jwtVerify
 */
function __testOnlyCheckClaims(verified, expectedWalletAddress, clientId) {
  const { payload } = verified;

  if (payload.aud !== clientId) {
    throw new Error('Web3Auth token audience does not match this project\'s client ID');
  }

  const normalizedExpected = expectedWalletAddress.toLowerCase();
  const wallets = Array.isArray(payload.wallets) ? payload.wallets : [];
  const matchingWallet = wallets.find(
    (w) => typeof w.address === 'string' && w.address.toLowerCase() === normalizedExpected,
  );

  if (!matchingWallet) {
    throw new Error('Web3Auth token does not contain the claimed wallet address');
  }

  return Promise.resolve({
    email: payload.email,
    name: payload.name,
    walletAddress: normalizedExpected,
  });
}

/**
 * Verify a Web3Auth idToken and confirm it proves ownership of
 * expectedWalletAddress.
 * @param {string} idToken
 * @param {string} expectedWalletAddress
 * @param {{ clientId: string }} config
 * @returns {Promise<{ email: string, name: string, walletAddress: string }>}
 * @throws {Error} on invalid signature, wrong audience, expiry, or wallet mismatch
 */
async function verifyWeb3AuthToken(idToken, expectedWalletAddress, { clientId }) {
  // Decode the issuer first (without verifying) to pick the right JWKS —
  // jose's jwtVerify needs the JWKS passed in up front.
  const [, payloadB64] = idToken.split('.');
  const unverifiedPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  const jwks = JWKS_BY_ISSUER[unverifiedPayload.iss];
  if (!jwks) {
    throw new Error(`Unrecognized Web3Auth token issuer: ${unverifiedPayload.iss}`);
  }

  const verified = await jwtVerify(idToken, jwks, {
    issuer: unverifiedPayload.iss,
    algorithms: ['ES256'],
  });

  return __testOnlyCheckClaims(verified, expectedWalletAddress, clientId);
}

verifyWeb3AuthToken.__testOnlyCheckClaims = __testOnlyCheckClaims;

module.exports = { verifyWeb3AuthToken };
```

- [ ] **Step 5: Run the tests — verify they pass**

Run: `cd backend && node --test src/utils/verifyWeb3AuthToken.test.js`
Expected: all 4 tests pass.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration
git add backend/src/utils/verifyWeb3AuthToken.js backend/src/utils/verifyWeb3AuthToken.test.js backend/package.json backend/package-lock.json
git commit -m "feat(backend): add verifyWeb3AuthToken utility with node:test coverage"
```

---

## Task 3: POST /api/auth/web3auth Route

**Files:**
- Modify: `backend/src/routes/auth.js`

**Interfaces:**
- Consumes: `verifyWeb3AuthToken(idToken, walletAddress, { clientId })` from Task 2.
- Produces: `POST /api/auth/web3auth` — body `{ idToken, walletAddress, avatar? }`, response `{ success: true, data: { token, user } }` on success (same shape the old `/login` returned, so frontend session handling in `utils/auth.js` needs no changes).

- [ ] **Step 1: Replace `backend/src/routes/auth.js` in full**

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { verifyWeb3AuthToken } = require('../utils/verifyWeb3AuthToken');

const router = express.Router();

const signToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );

router.post('/web3auth', async (req, res, next) => {
  try {
    const { idToken, walletAddress, avatar } = req.body;

    if (!idToken || !walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'idToken and walletAddress are required.',
      });
    }

    let verified;
    try {
      verified = await verifyWeb3AuthToken(idToken, walletAddress, {
        clientId: process.env.WEB3AUTH_CLIENT_ID,
      });
    } catch (verifyError) {
      return res.status(401).json({
        success: false,
        message: verifyError.message || 'Invalid Web3Auth token.',
      });
    }

    const normalizedWallet = verified.walletAddress;
    const normalizedEmail = (verified.email || '').trim().toLowerCase();

    let user = await User.findOne({ walletAddress: normalizedWallet });

    if (!user && normalizedEmail) {
      // Migration path: link a pre-existing password-based account by email
      // instead of creating a duplicate, so its Recording history carries over.
      user = await User.findOne({ email: normalizedEmail });
      if (user) {
        user.walletAddress = normalizedWallet;
        if (avatar && !user.avatar) user.avatar = avatar;
        await user.save();
      }
    }

    if (!user) {
      user = await User.create({
        name: verified.name || normalizedEmail.split('@')[0] || 'EtherXMeet User',
        email: normalizedEmail,
        walletAddress: normalizedWallet,
        avatar: avatar || null,
        authProvider: 'wallet',
      });
    }

    const token = signToken(user);

    return res.json({
      success: true,
      data: { token, user },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/me', auth, async (req, res, next) => {
  try {
    const { name } = req.body;
    const updates = {};
    if (name && name.trim()) updates.name = name.trim();

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    return res.json({ success: true, data: { user } });
  } catch (error) {
    return next(error);
  }
});

const os = require('os');

router.get('/local-ip', (req, res) => {
  const interfaces = os.networkInterfaces();
  let localIp = 'localhost';

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('wi-fi') || lowerName.includes('wlan') || lowerName.includes('ethernet')) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
          localIp = iface.address;
          break;
        }
      }
    }
    if (localIp !== 'localhost') break;
  }

  if (localIp === 'localhost') {
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
          localIp = iface.address;
          break;
        }
      }
      if (localIp !== 'localhost') break;
    }
  }

  res.json({ success: true, localIp });
});

module.exports = router;
```

Note: `email` is no longer accepted from the request body — it comes only from the verified `idToken` payload, so a client can't spoof someone else's email during account linking.

- [ ] **Step 2: Add `WEB3AUTH_CLIENT_ID` to backend env**

Add to `backend/.env` (create the line if the file exists; if it doesn't, note this for Task 9's manual verification setup):

```env
WEB3AUTH_CLIENT_ID=<same Client ID as VITE_WEB3AUTH_CLIENT_ID>
```

- [ ] **Step 3: Manual verification (no real Web3Auth token yet — just confirm the route rejects bad input)**

```bash
cd backend && npm run dev
```

In another terminal:
```bash
curl -s -X POST http://localhost:5000/api/auth/web3auth \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: `{"success":false,"message":"idToken and walletAddress are required."}`

```bash
curl -s -X POST http://localhost:5000/api/auth/web3auth \
  -H "Content-Type: application/json" \
  -d '{"idToken":"not-a-real-token","walletAddress":"0x0000000000000000000000000000000000dEaD"}'
```
Expected: `{"success":false,"message":"..."}` with a 401 status (malformed token rejected before hitting the network).

Stop the dev server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration
git add backend/src/routes/auth.js
git commit -m "feat(backend): replace password/Google auth routes with POST /api/auth/web3auth"
```

---

## Task 4: Remove Passport, Old Backend Dependencies

**Files:**
- Delete: `backend/src/config/passport.js`
- Modify: `backend/src/index.js`
- Modify: `backend/package.json`

- [ ] **Step 1: Delete the passport config**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration
rm backend/src/config/passport.js
```

- [ ] **Step 2: Remove passport wiring from index.js**

In `backend/src/index.js`, remove these lines:
```javascript
const passport = require('passport');
```
```javascript
const configurePassport = require('./config/passport');
```
```javascript
configurePassport();
```
```javascript
app.use(passport.initialize());
```

- [ ] **Step 3: Remove unused dependencies**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration/backend
npm uninstall bcryptjs passport passport-google-oauth20 @emailjs/nodejs
```

- [ ] **Step 4: Verify the backend still starts cleanly**

```bash
npm run dev
```
Expected: `EtherXMeet backend running on http://localhost:5000` with no errors about missing modules. Stop it (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration
git add backend/src/index.js backend/package.json backend/package-lock.json
git rm backend/src/config/passport.js
git commit -m "refactor(backend): remove Passport and password-hashing dependencies"
```

---

## Task 5: Frontend Dependencies + Env

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/.env`

- [ ] **Step 1: Install the SDK and its required peer stack**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration/frontend
npm install @web3auth/modal wagmi @tanstack/react-query
```

- [ ] **Step 2: Add the Client ID placeholder to frontend/.env**

Append to `frontend/.env`:

```env
# ── MetaMask Embedded Wallets (formerly Web3Auth) ──────────────────────────────
# Get this from https://developer.metamask.io — create a project, copy the
# Client ID. Also add Polygon Amoy (chain id 80002) as an allowed chain in
# that project's dashboard settings.
VITE_WEB3AUTH_CLIENT_ID=
```

**Stop here and get the Client ID from the user before continuing to Task 6** — the rest of the frontend work can be written and will build, but won't actually authenticate until this is filled in.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration
git add frontend/package.json frontend/package-lock.json frontend/.env
git commit -m "chore(frontend): add @web3auth/modal + wagmi dependencies and Client ID env var"
```

---

## Task 6: Rewrite WalletContext.jsx on Web3Auth + wagmi

**Files:**
- Modify: `frontend/src/context/WalletContext.jsx`

**Interfaces:**
- Produces: `useWallet()` → `{ account, chainId, balance, provider, signer, isConnecting, connectError, isReady, userInfo, login, logout }`. `account`/`signer`/`provider`/`chainId`/`balance` types match what the 9 consumer files already expect (string address, ethers v6 `JsonRpcSigner`, ethers v6 `BrowserProvider`, number, string). `login()` returns `Promise<{ idToken, walletAddress } | null>` — null if the user cancels. Task 7 (Login.jsx) depends on this `login()` return shape.
- Also exports: `WalletProvider` (composes `Web3AuthProvider` + `QueryClientProvider` + `WagmiProvider`) — `App.jsx` needs no changes since it already wraps the tree in `<WalletProvider>`.

- [ ] **Step 1: Replace `frontend/src/context/WalletContext.jsx` in full**

```javascript
import { createContext, useCallback, useContext, useMemo } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Web3AuthProvider,
  useWeb3AuthConnect,
  useWeb3AuthDisconnect,
  useWeb3AuthUser,
  useAuthTokenInfo,
} from '@web3auth/modal/react';
import { WagmiProvider as Web3AuthWagmiProvider } from '@web3auth/modal/react/wagmi';
import { WEB3AUTH_NETWORK, WALLET_CONNECTORS } from '@web3auth/modal';
import { useAccount, useBalance, useWalletClient } from 'wagmi';

const AMOY_CHAIN_ID = 80002;

const web3AuthContextConfig = {
  web3AuthOptions: {
    clientId: import.meta.env.VITE_WEB3AUTH_CLIENT_ID,
    web3AuthNetwork:
      import.meta.env.VITE_NETWORK === 'mainnet'
        ? WEB3AUTH_NETWORK.SAPPHIRE_MAINNET
        : WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
    modalConfig: {
      connectors: {
        [WALLET_CONNECTORS.AUTH]: {
          showOnModal: true,
          loginMethods: {
            google: { showOnModal: true },
            email_passwordless: { showOnModal: true },
            discord: { showOnModal: true },
            facebook: { showOnModal: false },
            twitter: { showOnModal: false },
            reddit: { showOnModal: false },
            twitch: { showOnModal: false },
            apple: { showOnModal: false },
            line: { showOnModal: false },
            github: { showOnModal: false },
            kakao: { showOnModal: false },
            linkedin: { showOnModal: false },
            weibo: { showOnModal: false },
            wechat: { showOnModal: false },
            farcaster: { showOnModal: false },
          },
        },
      },
      // Wallet-first login (MetaMask etc.) stays visible — only the AUTH
      // (social/email) connector's method list is restricted above.
    },
  },
};

const queryClient = new QueryClient();

// Converts wagmi's viem WalletClient into an ethers v6 JsonRpcSigner, so the
// rest of the app (useMeetingContract, useMeetingNFT, VerifiedChat) keeps
// using ethers exactly as it did with the old MetaMask/embedded-wallet flow.
function walletClientToSigner(walletClient) {
  const { account, chain, transport } = walletClient;
  const network = { chainId: chain.id, name: chain.name };
  const provider = new BrowserProvider(transport, network);
  return new JsonRpcSigner(provider, account.address);
}

const WalletContext = createContext(null);

function WalletBridge({ children }) {
  const { connect, isConnected, loading: isConnecting, connectorName, error: connectRawError } = useWeb3AuthConnect();
  const { disconnect } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();
  const { getAuthTokenInfo } = useAuthTokenInfo();
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { data: balanceData } = useBalance({ address, query: { enabled: Boolean(address) } });

  const connectError = connectRawError?.message || null;

  const provider = useMemo(() => {
    if (!walletClient) return null;
    return new BrowserProvider(walletClient.transport, { chainId: walletClient.chain.id, name: walletClient.chain.name });
  }, [walletClient]);

  const signer = useMemo(() => {
    if (!walletClient) return null;
    return walletClientToSigner(walletClient);
  }, [walletClient]);

  const login = useCallback(async () => {
    await connect();
    const { idToken } = await getAuthTokenInfo();
    if (!idToken || !address) return null;
    return { idToken, walletAddress: address };
  }, [connect, getAuthTokenInfo, address]);

  const logout = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const value = useMemo(() => ({
    account: address || null,
    chainId: chainId || AMOY_CHAIN_ID,
    balance: balanceData ? balanceData.formatted : '',
    provider,
    signer,
    isConnecting,
    connectError,
    isReady: isConnected,
    userInfo: userInfo || null,
    connectorName,
    login,
    logout,
  }), [address, chainId, balanceData, provider, signer, isConnecting, connectError, isConnected, userInfo, connectorName, login, logout]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function WalletProvider({ children }) {
  return (
    <Web3AuthProvider config={web3AuthContextConfig}>
      <QueryClientProvider client={queryClient}>
        <Web3AuthWagmiProvider>
          <WalletBridge>{children}</WalletBridge>
        </Web3AuthWagmiProvider>
      </QueryClientProvider>
    </Web3AuthProvider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
```

**Before running the app, verify these hook/export names against the installed package** — `@web3auth/modal/react` and `@web3auth/modal/react/wagmi` are newly-integrated (post-MetaMask-rebrand) and their exact export names may have shifted since this plan was written. Check `frontend/node_modules/@web3auth/modal/react/index.d.ts` (or the equivalent `.d.ts` under the `react` and `react/wagmi` subpaths) after `npm install` and adjust the import names in this file to match if they differ — the specific names that need checking are `Web3AuthProvider`, `useWeb3AuthConnect`, `useWeb3AuthDisconnect`, `useWeb3AuthUser`, `useAuthTokenInfo`, `WagmiProvider`, `WEB3AUTH_NETWORK`, `WALLET_CONNECTORS`.

- [ ] **Step 2: Manual verification — app starts and shows the connect flow**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration/frontend
npm run dev
```

Open the app in a browser. Expected: no red error overlay from Vite/React (a blank/broken login screen is fine at this point — `Login.jsx` isn't wired to `login()` yet, that's Task 7). If there's an import error, it's almost always the hook-name mismatch flagged above — fix it against the `.d.ts` file and retry.

Stop the dev server (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration
git add frontend/src/context/WalletContext.jsx
git commit -m "feat(frontend): rewrite WalletContext on Web3Auth + wagmi, same useWallet() shape"
```

---

## Task 7: Rewrite Login.jsx

**Files:**
- Modify: `frontend/src/pages/Login.jsx`

**Interfaces:**
- Consumes: `useWallet().login()` from Task 6 (returns `{ idToken, walletAddress } | null`).

- [ ] **Step 1: Replace `frontend/src/pages/Login.jsx` in full**

```javascript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import apiClient, { getApiErrorMessage } from '../utils/apiClient'
import { persistAuthSession, isAuthenticated } from '../utils/auth'
import { useWallet } from '../context/WalletContext'
import etherxLogo from '../assets/etherx_transparent.png'
import { AUTH_CSS } from './authShared'

export default function Login() {
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login, userInfo, account } = useWallet()

  useEffect(() => {
    if (isAuthenticated()) { navigate('/', { replace: true }) }
  }, [navigate])

  const handleSignIn = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await login()
      if (!result) {
        // User closed the modal without completing login — not an error.
        setLoading(false)
        return
      }
      const { idToken, walletAddress } = result
      const res = await apiClient.post('/api/auth/web3auth', {
        idToken,
        walletAddress,
        avatar: userInfo?.profileImage || null,
      })
      if (res.data.success) {
        persistAuthSession({ token: res.data.data.token, user: res.data.data.user })
        navigate('/', { replace: true })
        return
      }
      setError('Sign-in failed. Please try again.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Sign-in failed. Please try again.'))
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <style>{AUTH_CSS}</style>
      <img src={etherxLogo} alt="EtherXMeet" className="auth-corner-logo" />

      <AnimatePresence mode="wait">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          <img src={etherxLogo} alt="EtherXMeet" className="auth-card-logo" />
          <h1 className="auth-form-title">Welcome to EtherXMeet</h1>
          <p className="auth-form-sub">Sign in with Google, email, Discord, or your own wallet</p>

          {error && (
            <div className="auth-error-box">
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            className="auth-cta-btn"
            onClick={handleSignIn}
            disabled={loading || !!account}
          >
            {loading ? 'Signing in…' : account ? 'Signed in' : 'Sign in'}
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

This requires `VITE_WEB3AUTH_CLIENT_ID` and `WEB3AUTH_CLIENT_ID` to be filled in (Task 5, Task 3 Step 2) and both dev servers running.

```bash
# Terminal 1
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration/backend && npm run dev
# Terminal 2
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration/frontend && npm run dev
```

Navigate to `/login`. Click "Sign in". Expected: the Web3Auth modal opens showing Google, Email, Discord, and an external-wallet option. Complete one (Email OTP is fastest to test). Expected: modal closes, brief "Signing in…" state, then redirect to the dashboard. Check the Network tab — `POST /api/auth/web3auth` should return `200` with `{ success: true, data: { token, user } }`.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration
git add frontend/src/pages/Login.jsx
git commit -m "feat(frontend): replace password login with Web3Auth sign-in"
```

---

## Task 8: Remove Register/AuthCallback/ResetPassword

**Files:**
- Delete: `frontend/src/pages/Register.jsx`
- Delete: `frontend/src/pages/AuthCallback.jsx`
- Delete: `frontend/src/pages/ResetPassword.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/utils/constants.js`

- [ ] **Step 1: Delete the three pages**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration
rm frontend/src/pages/Register.jsx frontend/src/pages/AuthCallback.jsx frontend/src/pages/ResetPassword.jsx
```

- [ ] **Step 2: Update route constants**

In `frontend/src/utils/constants.js`, change:
```javascript
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  AUTH_CALLBACK: '/auth/callback',
  RESET_PASSWORD: '/reset-password/:token',
  JOIN: '/join',
  ROOM: '/room/:code',
  DASHBOARD: '/dashboard',
  RECORDINGS: '/recordings',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
};
```
to:
```javascript
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  JOIN: '/join',
  ROOM: '/room/:code',
  DASHBOARD: '/dashboard',
  RECORDINGS: '/recordings',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
};
```

- [ ] **Step 3: Update App.jsx**

In `frontend/src/App.jsx`, remove these imports:
```javascript
import Register from './pages/Register';
import AuthCallback from './pages/AuthCallback';
import ResetPassword from './pages/ResetPassword';
```

Remove these routes:
```javascript
<Route path={ROUTES.REGISTER}        element={<Register />} />
<Route path={ROUTES.AUTH_CALLBACK}   element={<AuthCallback />} />
<Route path={ROUTES.RESET_PASSWORD}  element={<ResetPassword />} />
```

- [ ] **Step 4: Manual verification**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration/frontend
npm run build
```
Expected: build succeeds with no errors about missing modules or unresolved imports (confirms nothing else references the deleted files or removed route constants).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration
git add frontend/src/App.jsx frontend/src/utils/constants.js
git rm frontend/src/pages/Register.jsx frontend/src/pages/AuthCallback.jsx frontend/src/pages/ResetPassword.jsx
git commit -m "refactor(frontend): remove password registration, Google callback, and reset-password pages"
```

---

## Task 9: Wire Logout Through Wallet Disconnect

**Files:**
- Modify: `frontend/src/pages/Landing.jsx`
- Modify: `frontend/src/components/layout/TopBar.jsx`
- Modify: `frontend/src/pages/Join.jsx`

Today, logging out only clears the app JWT (`clearAuthSession()` / raw `localStorage.removeItem`) — the Web3Auth session itself stays alive in the SDK's own storage until a hard refresh. With a real non-custodial session now involved, logout needs to actually end it.

- [ ] **Step 1: Update Landing.jsx**

In `frontend/src/pages/Landing.jsx`, find:
```javascript
const handleLogout = () => {
    clearAuthSession();
```
Change the function to also disconnect the wallet. Add the import:
```javascript
import { useWallet } from '../context/WalletContext';
```
Inside the component, add:
```javascript
const { logout } = useWallet();
```
And change `handleLogout` to:
```javascript
const handleLogout = () => {
    logout();
    clearAuthSession();
```
(keep the rest of the function — navigation etc. — unchanged after this point).

- [ ] **Step 2: Update TopBar.jsx**

Same pattern in `frontend/src/components/layout/TopBar.jsx`: add `import { useWallet } from '../../context/WalletContext';`, destructure `const { logout } = useWallet();` in the component, and change `handleLogout` to call `logout()` before `clearAuthSession()`.

- [ ] **Step 3: Update Join.jsx**

Same pattern in `frontend/src/pages/Join.jsx`: add the import (adjust relative path — `../context/WalletContext`), destructure `logout`, and change:
```javascript
const handleLogout = () => {
    localStorage.removeItem('nexmeet_token');
    localStorage.removeItem('nexmeet_user');
    navigate('/login');
};
```
to:
```javascript
const handleLogout = () => {
    logout();
    localStorage.removeItem('nexmeet_token');
    localStorage.removeItem('nexmeet_user');
    navigate('/login');
};
```

- [ ] **Step 4: Manual verification**

With both dev servers running and a completed sign-in from Task 7, click Logout from each of the three surfaces (dashboard TopBar, Landing page, Join page) in turn (re-sign-in between each test). Expected: redirected to `/login`, and clicking "Sign in" again re-opens the Web3Auth modal fresh (not a silently-still-connected session) — confirms `logout()` actually tore down the SDK session rather than just clearing the app's own token.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Admin/EtherXMeet/.worktrees/polygon-integration
git add frontend/src/pages/Landing.jsx frontend/src/components/layout/TopBar.jsx frontend/src/pages/Join.jsx
git commit -m "fix(frontend): actually terminate the Web3Auth session on logout"
```

---

## Task 10: Full Manual E2E Verification

No code changes — this is the spec's verification checklist, run end to end.

- [ ] **Test 1 — Google login (new user).** Sign in via Google. Expected: lands on dashboard, `User` document created with `authProvider: 'google'`, `walletAddress` set.
- [ ] **Test 2 — Email OTP login (new user).** Sign in via a different email. Expected: same as above with `authProvider: 'email_passwordless'`.
- [ ] **Test 3 — Discord login (new user).** Same, `authProvider: 'discord'`.
- [ ] **Test 4 — External wallet login (MetaMask).** Choose the wallet option inside the Web3Auth modal, connect MetaMask. Expected: same as above with `authProvider: 'wallet'`.
- [ ] **Test 5 — Migration.** If a pre-existing password-based `User` row exists from before this change (check MongoDB directly), sign in with Web3Auth using that same email via any method. Expected: no duplicate `User` document is created — the existing `_id` gets a `walletAddress` added. Confirm by checking that any of that user's existing `Recording` documents (`GET /api/recordings`, authenticated) still show up after sign-in.
- [ ] **Test 6 — Wallet-address spoofing rejected.** Manually POST to `/api/auth/web3auth` with a real idToken from Test 1/2/3/4 but a different `walletAddress` than the one that idToken actually proves. Expected: `401` with a message mentioning the wallet mismatch.
- [ ] **Test 7 — Dependent components render.** After signing in, visit any screen using `WalletBanner`, `ChainHUD`, `OnChainConfirmModal`, or `MeetingReceiptModal` (e.g. end a meeting to trigger the receipt flow). Expected: all show the correct wallet address/balance with no console errors — confirms `useWallet()`'s shape is compatible with zero changes to those files.
- [ ] **Test 8 — Old routes gone.** `curl -i http://localhost:5000/api/auth/login` (POST) and `.../register`, `.../forgot-password`, `.../google` → all `404`. Navigate to `/register`, `/auth/callback`, `/reset-password/anything` in the browser → React Router shows no matching route (falls through to whatever your router's not-found behavior is).
- [ ] **Test 9 — No stray dependencies.** `grep -r "bcryptjs\|passport-google-oauth20\|require('passport')" backend/src/` → no results.
- [ ] **Test 10 — Logout actually disconnects.** Covered in Task 9 Step 4 — repeat once here as final confirmation after all other changes are in place.

If all 10 pass, the feature is complete.
