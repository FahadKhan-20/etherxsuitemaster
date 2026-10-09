const assert = require('node:assert/strict');
const test = require('node:test');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-security-secret';
const { isAllowedOrigin } = require('../src/config/origins');

const withEnv = (t, values) => { const saved = {}; for (const [k, v] of Object.entries(values)) { saved[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; } t.after(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }); };

test('CORS allows configured origins and blocks others in production', t => {
  withEnv(t, { NODE_ENV: 'production', CLIENT_URL: 'https://meet.example.com', CLIENT_URL_LAN: undefined, FRONTEND_URL: undefined });
  assert.equal(isAllowedOrigin('https://meet.example.com'), true);
  assert.equal(isAllowedOrigin(undefined), true, 'same-origin and non-browser requests have no Origin');
  for (const origin of ['https://evil.example', 'http://localhost:3000', 'http://192.168.1.20:3000', 'https://meet.example.com.evil.example']) assert.equal(isAllowedOrigin(origin), false, origin);
});

test('development also allows localhost and private network origins', t => {
  withEnv(t, { NODE_ENV: 'development', CLIENT_URL: undefined, CLIENT_URL_LAN: undefined, FRONTEND_URL: undefined });
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:5173', 'http://192.168.1.20:3000', 'http://10.0.0.5:3000', 'http://172.16.4.2:3000']) assert.equal(isAllowedOrigin(origin), true, origin);
  for (const origin of ['https://evil.example', 'http://172.32.0.1:3000', 'http://localhost.evil.example']) assert.equal(isAllowedOrigin(origin), false, origin);
});
