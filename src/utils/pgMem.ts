import { newDb } from "pg-mem";

export async function createPgMem() {
  const db = newDb();
  const pg = db.adapters.createPg();
  const connection = new pg.Client()

  await connection.query(`
    CREATE TABLE tokens (
      address VARCHAR(42) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      symbol VARCHAR(10) NOT NULL,
      decimals INTEGER NOT NULL,
      price NUMERIC(38, 18) NOT NULL,
      last_updated TIMESTAMP WITH TIME ZONE NOT NULL
    );
  `);

  return db;
}
