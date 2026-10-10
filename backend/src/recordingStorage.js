// Where recording files live. With R2_* set they go to Cloudflare R2: Render wipes the server's own disk on
// every redeploy and restart, so files kept there disappear. Without R2 (local development) they stay in
// backend/uploads. The database only ever holds the metadata.
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '../uploads');
const LINK_SECONDS = 60 * 60; // a fresh R2 link is minted on every play/download, so it can be short

let client = null;
const r2 = () => {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  if (!client) {
    const { S3Client } = require('@aws-sdk/client-s3');
    client = new S3Client({
      region: 'auto',
      forcePathStyle: true, // https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
  }
  return { client, bucket: R2_BUCKET };
};

const localPath = key => path.join(uploadsDir, path.basename(key));

/** Moves an uploaded temp file (already in uploadsDir under `key`) to permanent storage. */
async function save(key, contentType) {
  const store = r2();
  if (!store) return; // local: the temp file is the stored file
  const { Upload } = require('@aws-sdk/lib-storage');
  try {
    // Multipart upload streams large recordings without holding them in memory.
    await new Upload({ client: store.client, params: { Bucket: store.bucket, Key: key, Body: fs.createReadStream(localPath(key)), ContentType: contentType } }).done();
  } finally {
    await fs.promises.rm(localPath(key), { force: true });
  }
}

async function remove(key) {
  const store = r2();
  if (!store) return fs.promises.rm(localPath(key), { force: true });
  const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
  await store.client.send(new DeleteObjectCommand({ Bucket: store.bucket, Key: key }));
}

async function exists(key) {
  const store = r2();
  if (!store) return fs.existsSync(localPath(key));
  const { HeadObjectCommand } = require('@aws-sdk/client-s3');
  try {
    await store.client.send(new HeadObjectCommand({ Bucket: store.bucket, Key: key }));
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) return false;
    throw error;
  }
}

/**
 * A short-lived R2 URL for playing (`download: false`) or saving the file, or null when files are local
 * and the caller streams them itself. R2 serves Range requests, so players can seek.
 */
async function signedUrl(key, { download, filename, contentType }) {
  const store = r2();
  if (!store) return null;
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  return getSignedUrl(store.client, new GetObjectCommand({
    Bucket: store.bucket,
    Key: key,
    ResponseContentType: contentType,
    ResponseContentDisposition: `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
  }), { expiresIn: LINK_SECONDS });
}

module.exports = { uploadsDir, localPath, save, remove, exists, signedUrl, usesR2: () => !!r2() };
