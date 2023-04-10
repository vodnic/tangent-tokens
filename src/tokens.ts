import dotenv from "dotenv";
import axios from 'axios';
import Web3 from "web3";
import log4js from "log4js";
import { Pool } from "pg";
import { AbiItem } from "web3-utils";
import { BigNumber } from "bignumber.js";
import _erc20ABI from "./abis/erc20ABI.json";

const erc20ABI = _erc20ABI as AbiItem[];

dotenv.config();

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.ethereumNodeUrl));

log4js.configure('log4js.json');
const logger = log4js.getLogger('Tokens');

const ISSUING_PLATFORM = 'ethereum';
const MILLISECONDS_IN_HOUR = 60 * 60 * 1000; // Milliseconds in 1 hour
const CACHE_DURATION = 5 * MILLISECONDS_IN_HOUR;
const COINGECKO_URL = 'https://api.coingecko.com/api/v3';

interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  price: BigNumber;
  lastUpdated: Date;
}

/*
CREATE TABLE tokens (
  address VARCHAR(42) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  decimals INTEGER NOT NULL,
  price NUMERIC(38, 18) NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL
);
*/

const tokenCache = new Map<string, Token>();
export async function getToken(dbPool: Pool, tokenAddress: string): Promise<Token> {
  // Validate address
  const ethAddressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
  const isValidEthAddress = ethAddressRegex.test(tokenAddress);
  if (!isValidEthAddress) {
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
    const priceExpired = token.lastUpdated.getTime() + CACHE_DURATION > Date.now();
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
      const liveData = await collectLiveData(dbPool, tokenAddress);
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


async function collectLiveData(dbPool: Pool, tokenAddress: string): Promise<Token> {
  try {
    const tokenContract = new web3.eth.Contract(erc20ABI, tokenAddress);
    const name = await tokenContract.methods.name().call();
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
  } catch (error) {
    logger.error(`Error fetching token data for ${tokenAddress}`, error);
    throw new Error(`Error fetching token data for ${tokenAddress} from the blockchain`);
  }
}

async function getCoingeckoPrice(tokenAddress: string): Promise<BigNumber | null> {
  logger.info(`Fetching token price for ${tokenAddress} from Coingecko`)
  try {
    const response = await axios.get(`${COINGECKO_URL}/simple/token_price/${ISSUING_PLATFORM}`, {
      params: {
        contract_addresses: tokenAddress,
        vs_currencies: 'usd',
      },
    });

    const keys = Object.keys(response.data);
    if (keys.length > 0 && response.data[keys[0]].usd !== undefined) {
      const price = response.data[keys[0]].usd;
      return new BigNumber(price);;
    } else {
      throw new Error('No price found');
    }
  } catch (error: any) {
    console.error(`Error fetching token price:` + error.code);
    console.error(error.message);
    console.error(error.response);
    return null;
  }
}