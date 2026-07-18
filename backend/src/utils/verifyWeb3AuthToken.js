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
