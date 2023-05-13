import log4js from "log4js";
import { BigNumber } from "bignumber.js";
import { Token } from "tangent-utils";
import { Web3Current, Addresses, Contracts } from "tangent-utils";
import { getCoingeckoCoinPrice, getCoingeckoTokenImage, getCoingeckoTokenPrice } from "./coingeckoClinet";
import { fetchTokenDataFromDb, updateTokenInDb } from "./persistance";

const web3 = Web3Current();

log4js.configure('log4js.json');
const logger = log4js.getLogger('Tokens');

const MILLISECONDS_IN_HOUR = 60 * 60 * 1000; // Milliseconds in 1 hour
const PRICE_VALIDITY = 10 * MILLISECONDS_IN_HOUR;

export async function getToken(tokenAddress: string): Promise<Token> {
  logger.info(`Fetching token data for ${tokenAddress}`);

  validateAddress(tokenAddress);
  let dbToken = await fetchTokenDataFromDb(tokenAddress);
  if (dbToken) {
    if (isPriceExpired(dbToken)) {
      logger.debug(`Stored price expired for ${tokenAddress}, fetching new price`);
      return updateTokenPrice(dbToken);
    } else {
      logger.debug(`Returning db data for ${tokenAddress}`);

      updateTokenInDb(dbToken);
      return dbToken;
    }
  } else {
    logger.debug(`Token not found in cache or DB, fetching live data`);
    return await collectLiveData(tokenAddress);
  }
}

function validateAddress(tokenAddress: string) {
  if (!web3.utils.isAddress(tokenAddress)) {
    logger.warn(`Invalid token address: ${tokenAddress}`);
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }
}

function isPriceExpired(token: Token): boolean {
  return token.lastUpdated.getTime() + PRICE_VALIDITY < Date.now();
}

async function updateTokenPrice(token: Token): Promise<Token> {
  token.price = await getCoingeckoPrice(token.address);
  updateTokenInDb(token);
  return token;
}

async function collectLiveData(tokenAddress: string): Promise<Token> {
  try {
    let token: Token = null;
    if (tokenAddress.toLocaleLowerCase() === Addresses.ETHER_DUMMY_ADDRESS.toLocaleLowerCase()) {
      token = {
        address: tokenAddress,
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
        price: await getCoingeckoCoinPrice(tokenAddress),
        lastUpdated: new Date(),
        image: await getCoingeckoTokenImage(tokenAddress)
      };
    } else if (tokenAddress === Addresses.WRAPPED_ETHER) {
      token = {
        address: tokenAddress,
        name: "Wrapped Ether",
        symbol: "WETH",
        decimals: 18,
        price: await getCoingeckoCoinPrice(Addresses.ETHER_DUMMY_ADDRESS),
        lastUpdated: new Date(),
        image: await getCoingeckoTokenImage(tokenAddress)
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
        image: await getCoingeckoTokenImage(tokenAddress)
      };
    }

    updateTokenInDb(token);
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