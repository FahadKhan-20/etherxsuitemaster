const fs = require('fs');
const path = require('path');
const pg = require('pg');

// bigint columns (recording sizes) fit in a JS number.
pg.types.setTypeParser(20, Number);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Whether a value can be a row id. Ids from old tokens or URLs must not reach a uuid column (Postgres would throw). */
const isId = value => typeof value === 'string' && UUID.test(value);

let client = null; // pg Pool, or an in-memory PGlite outside production

/** Runs one parameterized statement; resolves to { rows, rowCount }. */
const query = async (text, params = []) => {
  if (!client) throw new Error('Database is not connected.');
  const result = await client.query(text, params);
  return { rows: result.rows, rowCount: result.rowCount ?? result.affectedRows ?? 0 };
};

const isConnected = () => client !== null;

const connectDB = async ({ Pool = pg.Pool } = {}) => {
  try {
    const url = process.env.DATABASE_URL;
    try {
      if (!url) throw new Error('DATABASE_URL is not set');
      const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 15000, ssl: /sslmode=disable|localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
      await pool.query('select 1');
      client = pool;
      console.log(`Postgres connected: ${new URL(url).host}`);
    } catch (err) {
      // Production must never silently run on a throwaway database: every account and recording would vanish on restart.
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Cannot reach Postgres at DATABASE_URL (${err.message}). Set DATABASE_URL to your Supabase connection string.`);
      }
      console.warn(`Could not connect to Postgres (${err.message}). Starting embedded in-memory Postgres: all data is lost when the server restarts.`);
      const { PGlite } = require('@electric-sql/pglite');
      client = new PGlite();
    }
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    if (client.exec) await client.exec(schema);
    else await client.query(schema);
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.query = query;
module.exports.isConnected = isConnected;
module.exports.isId = isId;
