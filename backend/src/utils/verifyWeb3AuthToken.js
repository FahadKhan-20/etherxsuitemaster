const { createRemoteJWKSet, jwtVerify } = require('jose');

// Web3Auth/MetaMask Embedded Wallet issues tokens from different endpoints
// depending on the network environment (devnet vs. mainnet) and connector type.
//
// Uses a Map (rather than a plain object literal) so an attacker-controlled
// `iss` claim can never resolve to an inherited Object.prototype property
// (e.g. "constructor", "toString") and bypass the "unrecognized issuer" guard.
//
// Issuer → JWKS mapping:
//   SAPPHIRE_MAINNET  →  https://api-auth.web3auth.io
//   SAPPHIRE_DEVNET   →  https://web3auth.io  (iss emitted by devnet SDK)
//   authjs connector  →  https://authjs.web3auth.io
//   dev-api (legacy)  →  https://dev-api.web3auth.io
const JWKS_BY_ISSUER = new Map([
  // ── Production / Mainnet ─────────────────────────────────────────────────
  ['https://api-auth.web3auth.io',  createRemoteJWKSet(new URL('https://api-auth.web3auth.io/jwks'))],
  ['https://authjs.web3auth.io',    createRemoteJWKSet(new URL('https://authjs.web3auth.io/jwks'))],
  // ── Devnet / Sapphire Devnet ─────────────────────────────────────────────
  // SAPPHIRE_DEVNET tokens observed carrying iss as the bare domain string
  // "web3auth.io" (no scheme) — confirmed against a real devnet-issued
  // token, which does NOT match "https://web3auth.io". Keep both forms
  // mapped to the same JWKS endpoint in case a future SDK version emits
  // the scheme-prefixed form instead.
  ['web3auth.io',                   createRemoteJWKSet(new URL('https://web3auth.io/.well-known/jwks.json'))],
  ['https://web3auth.io',           createRemoteJWKSet(new URL('https://web3auth.io/.well-known/jwks.json'))],
  ['https://dev-api.web3auth.io',   createRemoteJWKSet(new URL('https://dev-api.web3auth.io/jwks'))],
]);

/**
 * Pure claim-checking logic, factored out so tests can exercise it without
 * hitting the network for real JWKS/signature verification.
 * @param {{ payload: object }} verified - result shape from jose's jwtVerify
 */
async function __testOnlyCheckClaims(verified, expectedWalletAddress, clientId) {
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

  return {
    email: payload.email,
    name: payload.name,
    walletAddress: normalizedExpected,
  };
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
  const jwks = JWKS_BY_ISSUER.get(unverifiedPayload.iss);
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
