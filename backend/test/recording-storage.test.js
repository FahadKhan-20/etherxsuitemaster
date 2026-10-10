const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const { S3Client } = require('@aws-sdk/client-s3');

test('with R2 configured, recordings go to R2 and leave the server disk', async t => {
  Object.assign(process.env, { R2_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret', R2_BUCKET: 'recordings' });
  const sent = [];
  const send = S3Client.prototype.send;
  S3Client.prototype.send = async function (command) {
    sent.push({ name: command.constructor.name, input: command.input });
    if (command.constructor.name === 'HeadObjectCommand' && command.input.Key === 'gone.webm') throw Object.assign(new Error('NotFound'), { $metadata: { httpStatusCode: 404 } });
    return {};
  };
  t.after(() => { S3Client.prototype.send = send; for (const k of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']) delete process.env[k]; });
  const storage = require('../src/recordingStorage');
  assert.equal(storage.usesR2(), true);

  fs.mkdirSync(storage.uploadsDir, { recursive: true });
  fs.writeFileSync(storage.localPath('r2-test.webm'), 'video bytes');
  await storage.save('r2-test.webm', 'video/webm');
  const put = sent.find(s => s.name === 'PutObjectCommand');
  assert.deepEqual([put.input.Bucket, put.input.Key, put.input.ContentType], ['recordings', 'r2-test.webm', 'video/webm']);
  assert.equal(fs.existsSync(storage.localPath('r2-test.webm')), false, 'temp file removed after upload');

  assert.equal(await storage.exists('r2-test.webm'), true);
  assert.equal(await storage.exists('gone.webm'), false);
  await storage.remove('r2-test.webm');
  assert.equal(sent.at(-1).name, 'DeleteObjectCommand');

  const url = new URL(await storage.signedUrl('r2-test.webm', { download: true, filename: 'Team sync.webm', contentType: 'video/webm' }));
  assert.equal(url.host, 'acct.r2.cloudflarestorage.com');
  assert.match(url.pathname, /^\/recordings\/r2-test\.webm$/);
  assert.equal(url.searchParams.get('response-content-disposition'), 'attachment; filename="Team sync.webm"');
  assert.equal(url.searchParams.get('X-Amz-Expires'), '3600');
});
