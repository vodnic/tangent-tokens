import log4js from "log4js";
import { Pool } from "pg";
import { BigNumber } from "bignumber.js";
import { Token } from "tangent-utils";
import { Web3Current, Addresses, Contracts } from "tangent-utils";
import { getCoingeckoCoinPrice, getCoingeckoTokenPrice } from "./coingeckoClinet";
import { fetchTokenDataFromDb, updateTokenInDb } from "./persistance";

const web3 = Web3Current();

log4js.configure('log4js.json');
const logger = log4js.getLogger('Tokens');

const MILLISECONDS_IN_HOUR = 60 * 60 * 1000; // Milliseconds in 1 hour
const CACHE_DURATION = 100 * MILLISECONDS_IN_HOUR;

const tokenCache = new Map<string, Token>();

export async function getToken(dbPool: Pool, tokenAddress: string): Promise<Token> {
  logger.info(`Fetching token data for ${tokenAddress}`);

  validateAddress(tokenAddress);
  let cachedToken = await getCachedTokenData(dbPool, tokenAddress);
  if (cachedToken) {
    if (isPriceExpired(cachedToken)) {
      logger.debug(`Cached price expired for ${tokenAddress}, fetching new price`);
      return updateTokenPrice(dbPool, cachedToken);
    } else {
      logger.debug(`Returning cached data for ${tokenAddress}`);
      return cachedToken;
    }
  } else {
    logger.debug(`Token not found in cache or DB, fetching live data`);
    return await collectLiveData(dbPool, tokenAddress);
  }
}

function validateAddress(tokenAddress: string) {
  if (!web3.utils.isAddress(tokenAddress)) {
    logger.warn(`Invalid token address: ${tokenAddress}`);
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }
}

async function getCachedTokenData(dbPool: Pool, tokenAddress: string): Promise<Token | null> {
  let token: Token = null
  if (tokenCache.has(tokenAddress)) {
    token = tokenCache.get(tokenAddress);
  } else {
    // Check DB
    token = await fetchTokenDataFromDb(dbPool, tokenAddress);
    tokenCache.set(tokenAddress, token);
  }
  return token;
}

function isPriceExpired(token: Token): boolean {
  return token.lastUpdated.getTime() + CACHE_DURATION < Date.now();
}

async function updateTokenPrice(dbPool: Pool, token: Token): Promise<Token> {
  token.price = await getCoingeckoPrice(token.address);
  updateTokenInDb(dbPool, token);
  tokenCache.set(token.address, token);
  return token;
}

async function collectLiveData(dbPool: Pool, tokenAddress: string): Promise<Token> {
  try {
    let token: Token = null;
    if (tokenAddress === Addresses.ETHER_DUMMY_ADDRESS) {
      token = {
        address: tokenAddress,
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
        price: await getCoingeckoCoinPrice(tokenAddress),
        lastUpdated: new Date(),
      };
    } else {
      // Some tokens (like MKR) might fail here, as they don't implement name and symbol of ERC20
      const tokenContract = Contracts.ERC20(web3, tokenAddress);
      token = {
        address: tokenAddress,
        name: await tokenContract.methods.name().call(),
        symbol: await tokenContract.methods.symbol().call(),
        decimals: await tokenContract.methods.decimals().call(),
        price: await getCoingeckoPrice(tokenAddress),
        lastUpdated: new Date(),
      };
    }
    updateTokenInDb(dbPool, token);
    tokenCache.set(tokenAddress, token);
    return token;
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