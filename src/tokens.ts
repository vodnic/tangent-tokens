import log4js from "log4js";
import { Pool } from "pg";
import { BigNumber } from "bignumber.js";
import { Token } from "tangent-utils";
import { Web3Current } from "tangent-utils";
import { Addresses } from "tangent-utils";
import { Contracts } from "tangent-utils";
import { getCoingeckoCoinPrice, getCoingeckoTokenPrice } from "./coingeckoClinet";

const web3 = Web3Current();

log4js.configure('log4js.json');
const logger = log4js.getLogger('Tokens');

const MILLISECONDS_IN_HOUR = 60 * 60 * 1000; // Milliseconds in 1 hour
const CACHE_DURATION = 1000 * MILLISECONDS_IN_HOUR; // TODO: remove after testing

const tokenCache = new Map<string, Token>();
export async function getToken(dbPool: Pool, tokenAddress: string): Promise<Token> {
  // Validate address
  if (!web3.utils.isAddress(tokenAddress)) {
    logger.warn(`Invalid token address: ${tokenAddress}`);
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }

  logger.info(`Fetching token data for ${tokenAddress}`);
  let token = null;

  // Check cache
  if (tokenCache.has(tokenAddress)) {
    token = tokenCache.get(tokenAddress);
  } else {
    // Check DB
    token = await fetchDataFromDb(dbPool, tokenAddress);
    tokenCache.set(tokenAddress, token);
  }

  // Cache exists
  if (token) {
    const priceExpired = token.lastUpdated.getTime() + CACHE_DURATION < Date.now();
    if (!priceExpired) {
      // Price is still valid, return cached data
      logger.debug(`Returning cached data for ${tokenAddress}`);
      return token;
    } else {
      // Price is expired, fetch new price
      logger.debug(`Cached price expired for ${tokenAddress}, fetching new price`);
      const price = await getCoingeckoPrice(tokenAddress);
      token.price = price;
      updateTokenInDb(dbPool, token);
      tokenCache.set(tokenAddress, token);
      return token;
    }
  } else {
    // No cache, fetch fresh data
    try {
      const liveData = await collectLiveData(tokenAddress);
      updateTokenInDb(dbPool, liveData);
      tokenCache.set(tokenAddress, liveData);
      return liveData;
    } catch (error) {
      logger.error(`Error fetching token data for ${tokenAddress}`, error);
      throw error;
    }
  }
}

async function fetchDataFromDb(dbPool: Pool, tokenAddress: string): Promise<Token | null> {
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

async function updateTokenInDb(dbPool: Pool, token: Token): Promise<void> {
  const client = await dbPool.connect();
  try {
    await client.query('INSERT INTO tokens (address, name, symbol, decimals, price, last_updated) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (address) DO UPDATE SET name = $2, symbol = $3, decimals = $4, price = $5, last_updated = $6', [
      token.address,
      token.name,
      token.symbol,
      token.decimals,
      token.price.toString(),
      token.lastUpdated,
    ]);
  } finally {
    client.release();
  }
}


async function collectLiveData(tokenAddress: string): Promise<Token> {
  try {
    if (tokenAddress === Addresses.ETHER_DUMMY_ADDRESS) {
      const price = await getCoingeckoPrice(tokenAddress);

      const token: Token = {
        address: tokenAddress,
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
        price: price,
        lastUpdated: new Date(),
      };
      return token;
    } else {
      // Some tokens (like MKR) might fail here, as they don't implement name and symbol of ERC20
      const tokenContract = Contracts.ERC20(web3, tokenAddress);
      const name: string = await tokenContract.methods.name().call();
      const symbol = await tokenContract.methods.symbol().call();
      const decimals = await tokenContract.methods.decimals().call();

      const price = await getCoingeckoPrice(tokenAddress);

      const token: Token = {
        address: tokenAddress,
        name: name,
        symbol: symbol,
        decimals: decimals,
        price: price,
        lastUpdated: new Date(),
      };
      return token;
    }
  } catch (error) {
    logger.error(`Error fetching token data for ${tokenAddress}`, error);
    throw new Error(`Error fetching token data for ${tokenAddress} from the blockchain`);
  }
}

async function getCoingeckoPrice(tokenAddress: string): Promise<BigNumber | null> {
  logger.debug(`Fetching token price for ${tokenAddress} from Coingecko`)
  if (tokenAddress === Addresses.ETHER_DUMMY_ADDRESS) {
    return getCoingeckoCoinPrice('ethereum');
  } else {
    return getCoingeckoTokenPrice(tokenAddress);
  }
}