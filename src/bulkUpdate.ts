import axios from 'axios';
import log4js from "log4js";
import { Pool } from "pg";
import { BigNumber } from "bignumber.js";
import { Token } from "./models";

log4js.configure('log4js.json');
const logger = log4js.getLogger('Tokens');

const ISSUING_PLATFORM = 'ethereum';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3';
const MAX_BULK_UPDATE = 15;
const ETHER_DUMMY_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export async function bulkUpdateTokensInDb(dbPool: Pool) {
  logger.info('Bulk updating tokens in DB');
  const allTokens: Token[] = await fetchAllTokensFromDB(dbPool);
  const addresses: string[] = allTokens.map(token => token.address);
  const tokenAddress: string[] = addresses.filter(address => address !== ETHER_DUMMY_ADDRESS);
  const jointAddress = tokenAddress.join(',');

  logger.debug(`Fetching new price for ${tokenAddress.length} tokens`);
  const freshPrices = await fetchFreshPrices(jointAddress);

  const keys = Object.keys(freshPrices.data);
  logger.debug(`Received ${keys.length} prices from CoinGecko`);
  keys.forEach((address: string) => {
    const price = freshPrices.data[address].usd;
    const token = allTokens.find(token => token.address === address);
    if (token) {
      token.price = new BigNumber(price);
      token.lastUpdated = new Date();
    }
  });

  updateTokensInDb(dbPool, allTokens);
}

async function fetchFreshPrices(tokenAddresses: string): Promise<any> {
  const response = await axios.get(`${COINGECKO_URL}/simple/token_price/${ISSUING_PLATFORM}`, {
    params: { contract_addresses: tokenAddresses, vs_currencies: 'usd', }});
  return response
}

async function updateTokensInDb(dbPool: Pool, tokens: Token[]) {
  logger.info('Updating tokens in DB');
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    for (const token of tokens) {
      await client.query(
        'UPDATE tokens SET price = $1, last_updated = $2 WHERE address = $3',
        [token.price.toString(), token.lastUpdated, token.address],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating tokens in DB', error);
    throw error;
  } finally {
    client.release();
  }
}

async function fetchAllTokensFromDB(dbPool: Pool): Promise<Token[]> {
  const client = await dbPool.connect();
  const tokens: Token[] = [];
  try {
    const result = await client.query('SELECT * FROM tokens ORDER BY last_updated ASC LIMIT ' + MAX_BULK_UPDATE);
    if (result.rows.length > 0) {
      result.rows.forEach((row: any) => {
        const token: Token = {
          address: row.address,
          name: row.name,
          symbol: row.symbol,
          decimals: row.decimals,
          price: new BigNumber(row.price),
          lastUpdated: row.last_updated,
        };
        tokens.push(token);
      });
    } 
    return tokens;
  } catch (error) {
    logger.error('Error fetching all tokens from DB', error);
    throw error;
  } finally {
    client.release();
  }
}