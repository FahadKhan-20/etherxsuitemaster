const { query, isId } = require('../config/db');

const COLUMNS = {
  name: 'name',
  email: 'email',
  authProvider: 'auth_provider',
  googleId: 'google_id',
  appleId: 'apple_id',
  password: 'password',
  walletAddress: 'wallet_address',
  avatar: 'avatar',
  resetPasswordToken: 'reset_password_token',
  resetPasswordExpires: 'reset_password_expires',
};
const lower = value => (typeof value === 'string' ? value.trim().toLowerCase() : value);

// API shape: clients read `_id`. The password hash is included only on request.
const toUser = (row, { withPassword = false } = {}) => row && {
  _id: row.id,
  name: row.name,
  email: row.email,
  authProvider: row.auth_provider,
  googleId: row.google_id,
  appleId: row.apple_id,
  walletAddress: row.wallet_address,
  avatar: row.avatar,
  preferences: {
    reminders: { enabled: row.reminders_enabled, minutes: row.reminder_minutes },
    privacy: { retentionDays: row.retention_days, allowRecording: row.allow_recording },
  },
  createdAt: row.created_at,
  ...(withPassword ? { password: row.password } : {}),
};

const one = async (sql, params, options) => toUser((await query(sql, params)).rows[0], options) || null;

const findById = id => (isId(String(id)) ? one('select * from users where id = $1', [String(id)]) : Promise.resolve(null));
const findByEmail = (email, options) => one('select * from users where email = $1', [lower(email)], options);
const findByWallet = address => one('select * from users where wallet_address = $1', [lower(address)]);
/** Account linked to this provider id, else the account with this email. */
const findByProviderOrEmail = (provider, providerId, email) =>
  one(`select * from users where ${provider === 'apple' ? 'apple_id' : 'google_id'} = $1 or email = $2 order by (email = $2) limit 1`, [providerId, lower(email)]);
const findByResetToken = hashedToken =>
  one('select * from users where reset_password_token = $1 and reset_password_expires > now()', [hashedToken]);

async function create(fields) {
  const values = { ...fields, email: lower(fields.email), walletAddress: lower(fields.walletAddress) };
  const keys = Object.keys(COLUMNS).filter(key => values[key] !== undefined && values[key] !== null);
  return one(
    `insert into users (${keys.map(key => COLUMNS[key]).join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
    keys.map(key => values[key])
  );
}

/** Sets the given profile fields; resolves to the updated user or null. */
async function update(id, fields) {
  if (!isId(String(id))) return null;
  const values = { ...fields };
  if ('email' in values) values.email = lower(values.email);
  const keys = Object.keys(COLUMNS).filter(key => values[key] !== undefined);
  if (!keys.length) return findById(id);
  return one(
    `update users set ${keys.map((key, i) => `${COLUMNS[key]} = $${i + 2}`).join(', ')} where id = $1 returning *`,
    [String(id), ...keys.map(key => values[key])]
  );
}

/** Partial preferences update: { reminders: { enabled, minutes }, privacy: { retentionDays, allowRecording } }. */
async function updatePreferences(id, { reminders = {}, privacy = {} }) {
  if (!isId(String(id))) return null;
  const sets = [['reminders_enabled', reminders.enabled], ['reminder_minutes', reminders.minutes], ['retention_days', privacy.retentionDays], ['allow_recording', privacy.allowRecording]]
    .filter(([, value]) => value !== undefined);
  return one(`update users set ${sets.map(([column], i) => `${column} = $${i + 2}`).join(', ')} where id = $1 returning *`, [String(id), ...sets.map(([, value]) => value)]);
}

/** Whether this account allows recording in meetings it hosts (default yes). */
async function allowsRecording(id) {
  if (!isId(String(id))) return true;
  const { rows } = await query('select allow_recording from users where id = $1', [String(id)]);
  return rows[0]?.allow_recording !== false;
}

/** Users who chose a retention period: [{ _id, retentionDays }]. */
async function findWithRetention() {
  const { rows } = await query('select id, retention_days from users where retention_days is not null');
  return rows.map(row => ({ _id: row.id, retentionDays: row.retention_days }));
}

module.exports = { findById, findByEmail, findByWallet, findByProviderOrEmail, findByResetToken, create, update, updatePreferences, allowsRecording, findWithRetention };
