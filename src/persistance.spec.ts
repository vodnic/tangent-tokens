import { newDb } from "pg-mem";
import { Pool } from "pg";
import { Token } from "tangent-utils";
import { BigNumber } from "bignumber.js";
import * as tangentUtils from "tangent-utils";

jest.mock("tangent-utils", () => {
  const originalTangentUtils = jest.requireActual("tangent-utils");
  return {
    ...originalTangentUtils,
    DbPool: jest.fn(),
  };
});

const db = newDb();
const pg = db.adapters.createPg();
const connection = new pg.Client()

const mockDbPool = {
  connect: () => {
    return {
      query: connection.query.bind(connection),
      release: jest.fn(),
    };
  },
  query: connection.query.bind(connection),
  end: jest.fn(),
};

(tangentUtils.DbPool as jest.Mock).mockImplementation(() => mockDbPool);

import { fetchTokenDataFromDb, updateTokenInDb } from "./persistance";

beforeAll(async () => {
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
});


describe("fetchTokenDataFromDb", () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = connection;
  });

  it("returns token data from the database", async () => {
    // Insert a sample token into the database
    await pool.query(`
      INSERT INTO tokens (address, name, symbol, decimals, price, last_updated)
      VALUES ('0x123', 'Test Token', 'TT', 18, '1.0', NOW());
    `);

    const token = await fetchTokenDataFromDb("0x123");
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
    pool = connection;
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

    await updateTokenInDb(token);

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
