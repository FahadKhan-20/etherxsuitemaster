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
