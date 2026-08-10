const crypto = require('crypto');
const { verifyMessage } = require('ethers');

// In-memory single-use nonce store: lowercased walletAddress -> { nonce, expires }.
// Web3Auth login proves identity by having the user's embedded wallet sign a
// server-issued nonce; the backend recovers the signer address and confirms it
// matches the claimed wallet. This anchors trust on wallet-ownership (which the
// app already uses as the user identity) and needs no Web3Auth JWKS — the
// documented JWKS endpoints don't publish the sapphire_devnet signing key, so
// verifying the idToken's signature directly isn't currently possible.
const nonceStore = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Generate + store a fresh single-use nonce for a wallet address. */
function issueNonce(walletAddress) {
  const key = walletAddress.toLowerCase();
  const nonce = `EtherXMeet login: ${crypto.randomBytes(16).toString('hex')} @ ${Date.now()}`;
  nonceStore.set(key, { nonce, expires: Date.now() + NONCE_TTL_MS });
  return nonce;
}

/**
 * Verify that `signature` over `nonce` was produced by `walletAddress`, and that
 * the nonce is the exact one we issued (unexpired, single-use).
 * Throws on any mismatch. Consumes the nonce on success (and on address mismatch).
 * @returns {string} the checksummed recovered address (lowercased) on success
 */
function verifyNonceSignature(walletAddress, nonce, signature) {
  const key = walletAddress.toLowerCase();
  const entry = nonceStore.get(key);

  if (!entry) throw new Error('No login challenge found — request a nonce first.');
  if (entry.expires < Date.now()) {
    nonceStore.delete(key);
    throw new Error('Login challenge expired — please try again.');
  }
  if (entry.nonce !== nonce) {
    throw new Error('Login challenge mismatch.');
  }

  let recovered;
  try {
    recovered = verifyMessage(nonce, signature);
  } catch {
    throw new Error('Invalid signature.');
  }

  // Consume the nonce regardless of match so a captured challenge can't be reused.
  nonceStore.delete(key);

  if (recovered.toLowerCase() !== key) {
    throw new Error('Signature does not match the claimed wallet address.');
  }
  return recovered.toLowerCase();
}

// Periodic sweep of expired nonces so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of nonceStore) {
    if (v.expires < now) nonceStore.delete(k);
  }
}, NONCE_TTL_MS).unref();

module.exports = { issueNonce, verifyNonceSignature };
