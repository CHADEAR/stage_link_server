import pkg from "pg";
const { Pool } = pkg;

const {
  DB_HOST = "localhost",
  DB_PORT = 5432,
  DB_USER = "appuser",
  DB_PASS = "secret123",
  DB_NAME = "appdb",
} = process.env;

const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
});

export default pool;
