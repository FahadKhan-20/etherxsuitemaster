const { createRemoteJWKSet, jwtVerify } = require('jose');

// Web3Auth/MetaMask Embedded Wallet issues tokens from different endpoints
// depending on the network environment (devnet vs. mainnet) and connector type.
//
// Uses a Map (rather than a plain object literal) so an attacker-controlled
// `iss` claim can never resolve to an inherited Object.prototype property
// (e.g. "constructor", "toString") and bypass the "unrecognized issuer" guard.
//
// The dashboard's own Project Settings page (developer.metamask.io) states
// the real JWKS endpoint for this project directly:
//   https://api-auth.web3auth.io/.well-known/jwks.json
// A real devnet-issued idToken's `iss` claim was observed to be the bare
// string "web3auth.io" (no scheme) — that value, and its scheme-prefixed
// form, both resolve to the confirmed JWKS endpoint above (NOT a guessed
// endpoint at the web3auth.io domain itself, which returned an unparseable
// non-JSON response and broke verification on the first attempt).
const CONFIRMED_JWKS = createRemoteJWKSet(new URL('https://api-auth.web3auth.io/.well-known/jwks.json'));
const JWKS_BY_ISSUER = new Map([
  ['web3auth.io',                   CONFIRMED_JWKS],
  ['https://web3auth.io',           CONFIRMED_JWKS],
  ['https://api-auth.web3auth.io',  CONFIRMED_JWKS],
  ['https://authjs.web3auth.io',    createRemoteJWKSet(new URL('https://authjs.web3auth.io/.well-known/jwks.json'))],
  ['https://dev-api.web3auth.io',   createRemoteJWKSet(new URL('https://dev-api.web3auth.io/.well-known/jwks.json'))],
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
  const [headerB64, payloadB64] = idToken.split('.');
  const unverifiedHeader = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
  const unverifiedPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  console.log('TEMP DEBUG idToken header:', unverifiedHeader);
  console.log('TEMP DEBUG idToken iss/aud:', unverifiedPayload.iss, unverifiedPayload.aud);
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
