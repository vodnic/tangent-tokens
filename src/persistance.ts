import { Pool } from "pg";
import { DbPool, Token } from "tangent-utils";
import { BigNumber } from "bignumber.js";

const dbPool = DbPool();

export async function fetchTokenDataFromDb(ignore: Pool, tokenAddress: string): Promise<Token | null> {
  const client = await dbPool.connect();
  try {
    const result = await client.query('SELECT * FROM tokens WHERE address = $1', [tokenAddress]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const token: Token = {
        address: row.address,
        name: row.name,
        symbol: row.symbol,
        decimals: row.decimals,
        price: new BigNumber(row.price),
        lastUpdated: row.last_updated,
      };
      return token;
    } else {
      return null;
    }
  } finally {
    client.release();
  }
}

export async function updateTokenInDb(dbPool: Pool, token: Token): Promise<void> {
  const client = await dbPool.connect();
  try {
    await client.query('INSERT INTO tokens (address, name, symbol, decimals, price, last_updated) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (address) DO UPDATE SET name = $2, symbol = $3, decimals = $4, price = $5, last_updated = $6', [
      token.address,
      token.name,
      token.symbol,
      token.decimals,
      token.price ? token.price.toString() : null,
      token.lastUpdated,
    ]);
  } finally {
    client.release();
  }
}