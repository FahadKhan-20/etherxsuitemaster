const { query } = require('../config/db');

/** Stores (or moves to this user) a browser's push subscription. */
const save = (userId, { endpoint, keys }) => query(
  `insert into push_subscriptions (endpoint, user_id, keys) values ($1, $2, $3)
   on conflict (endpoint) do update set user_id = excluded.user_id, keys = excluded.keys`,
  [endpoint, String(userId), JSON.stringify({ p256dh: keys.p256dh, auth: keys.auth })]
);

const remove = (endpoint, userId) => (userId
  ? query('delete from push_subscriptions where endpoint = $1 and user_id = $2', [endpoint, String(userId)])
  : query('delete from push_subscriptions where endpoint = $1', [endpoint]));

/** Every subscription of these users: [{ endpoint, keys, userId }]. */
const forUsers = async userIds => (await query(
  'select endpoint, keys, user_id from push_subscriptions where user_id = any($1::uuid[])',
  [userIds.map(String)]
)).rows.map(row => ({ endpoint: row.endpoint, keys: row.keys, userId: row.user_id }));

module.exports = { save, remove, forUsers };
