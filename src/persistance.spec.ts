import { Pool } from "pg";
import { Token } from "tangent-utils";
import { BigNumber } from "bignumber.js";
import { fetchTokenDataFromDb, updateTokenInDb } from "./persistance";
import { createPgMem } from "./utils/pgMem";

describe("fetchTokenDataFromDb", () => {
  let pool: Pool;

  beforeEach(async () => {
    const db = await createPgMem();
    const pg = db.adapters.createPg();
    pool = new pg.Pool();
  });

  afterEach(async () => {
    await pool.end();
  });

  it("returns token data from the database", async () => {
    // Insert a sample token into the database
    await pool.query(`
      INSERT INTO tokens (address, name, symbol, decimals, price, last_updated)
      VALUES ('0x123', 'Test Token', 'TT', 18, '1.0', NOW());
    `);

    const token = await fetchTokenDataFromDb(pool, "0x123");
    expect(token).toEqual<Token>({
      address: "0x123",
      name: "Test Token",
      symbol: "TT",
      decimals: 18,
      price: new BigNumber("1.0"),
      lastUpdated: expect.any(Date),
    });
  });
});

describe("updateTokenInDb", () => {
  let pool: Pool;

  beforeEach(async () => {
    const db = await createPgMem();
    const pg = db.adapters.createPg();
    pool = new pg.Pool();
  });

  afterEach(async () => {
    await pool.end();
  });

  it("updates the token data in the database", async () => {
    const token: Token = {
      address: "0x123",
      name: "Test Token",
      symbol: "TT",
      decimals: 18,
      price: new BigNumber("1.0"),
      lastUpdated: new Date(),
    };

    await updateTokenInDb(pool, token);

    const { rows } = await pool.query("SELECT * FROM tokens WHERE address = '0x123'");
    expect(rows[0]).toEqual({
      address: "0x123",
      name: "Test Token",
      symbol: "TT",
      decimals: 18,
      price: new BigNumber(1.0).toNumber(),
      last_updated: expect.any(Date),
    });
  });
});
