import axios from 'axios';
import log4js from "log4js";
import { BigNumber } from "bignumber.js";
import { Token } from "tangent-utils";
import { Addresses } from 'tangent-utils';
import { DbPool } from 'tangent-utils';

log4js.configure('log4js.json');
const logger = log4js.getLogger('Tokens');

const dbPool = DbPool();

const ISSUING_PLATFORM = 'ethereum';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3';
const MAX_BULK_UPDATE = 50; // I can't find anythying in the docs, I tried 20, and got different return counts

/*
* Fetches oldest MAX_BULK_UPDATE tokens from DB and updates their prices
* from CoinGecko. This is different logic from the regular getToken() function
* in that it does one request to CoinGecko for all tokens, instead of one per 
* token in getToken().
*/
export async function bulkUpdateTokensInDb() {
  logger.info('Bulk updating tokens in DB');
  const allTokens: Token[] = await fetchAllTokensFromDB();
  const addresses: string[] = allTokens.map(token => token.address);
  const tokenAddress: string[] = addresses.filter(address => address !== Addresses.ETHER_DUMMY_ADDRESS);
  const jointAddress = tokenAddress.join(',');

  logger.debug(`Fetching new price for ${tokenAddress.length} tokens`);
  const freshPrices = await fetchFreshPrices(jointAddress);

  const keys = Object.keys(freshPrices.data);
  logger.debug(`Received ${keys.length} prices from CoinGecko`);
  keys.forEach((address: string) => {
    let price = freshPrices.data[address].usd;
    if (price === undefined) {
      logger.warn(`Received undefined price for ${address}`);
      price = null;
    }
    // Coingecko returns lowercase addresses, but we store them in origianl form in DB
    const token = allTokens.find(token => token.address.toLowerCase() === address.toLowerCase());
    if (token) {
      token.price = new BigNumber(price);
    }
  });

  // Update lastUpdated for all tokens; stop "priceless" tokens to be update on the next run
  allTokens.forEach(token => { token.lastUpdated = new Date();});

  updateTokensInDb(allTokens);
}

async function fetchFreshPrices(tokenAddresses: string): Promise<any> {
  try {
  const response = await axios.get(`${COINGECKO_URL}/simple/token_price/${ISSUING_PLATFORM}`, {
    params: { contract_addresses: tokenAddresses, vs_currencies: 'usd', }});
  return response
  } catch (error) {
    logger.error(`Error bulk fetching token prices from CoinGecko`);
  }
}

async function updateTokensInDb(tokens: Token[]) {
  logger.info('Updating tokens in DB');
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    for (const token of tokens) {
      await client.query(
        'UPDATE tokens SET price = $1, last_updated = $2 WHERE address = $3',
        [token.price ? token.price.toString() : null, token.lastUpdated, token.address],
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

async function fetchAllTokensFromDB(): Promise<Token[]> {
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
          price: row.price ? new BigNumber(row.price) : null,
          lastUpdated: row.last_updated,
          image: row.image_url,
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
