import log4js from "log4js";
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { Addresses } from "tangent-utils";

log4js.configure('log4js.json');
const logger = log4js.getLogger('Tokens');

const COINGECKO_URL = 'https://api.coingecko.com/api/v3';
const ISSUING_PLATFORM = 'ethereum';
const CURRENCY = 'usd';

export async function getCoingeckoCoinPrice(coinName: string): Promise<BigNumber> {
  try {
    const path = `${COINGECKO_URL}/coins/${coinName}`;
    const params = { ids: coinName, vs_currencies: CURRENCY };
    const response = await axios.get(path, { params: params });

    return extractPriceFromResponse(response);
  } catch (error) {
    console.error(`Error fetching token price:` + error.code);
    console.error(error.message);
    console.error(error.response);
    return null;
  }
}

export async function getCoingeckoTokenPrice(tokenAddress: string): Promise<BigNumber> {
  try {
    const path = `${COINGECKO_URL}/simple/token_price/${ISSUING_PLATFORM}`;
    const params = { contract_addresses: tokenAddress, vs_currencies: CURRENCY}
    const response = await axios.get(path, { params: params });

    return extractPriceFromResponse(response);
  } catch (error) {
    console.error(`Error fetching token price:` + error.code);
    console.error(error.message);
    console.error(error.response);
    return null;
  }
}

function extractPriceFromResponse(response: any): BigNumber {
  const keys = Object.keys(response.data);
  if (keys.length > 0 && response.data[keys[0]].usd !== undefined) {
    const price = response.data[keys[0]].usd;
    return new BigNumber(price);
  } else {
    logger.warn(`No price found in response from CoinGecko for token ${keys[0]}`);
    return null;
  }
}

export async function getCoingeckoTokenImage(tokenAddress: string): Promise<string | null> {
  try {
    let imageUrl = null;
    if (tokenAddress == Addresses.ETHER_DUMMY_ADDRESS) {  
      imageUrl = 'https://assets.coingecko.com/coins/images/279/thumb/ethereum.png?1595348880'; 
    } else {
      const path = `${COINGECKO_URL}/coins/ethereum/contract/${tokenAddress}`;
      const response = await axios.get(path);

      imageUrl = extractImageUrlFromResponse(response);
    }

    if (imageUrl) {
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');

      return base64Image;
    } else {
      return null;
    }

  } catch (error) {
    console.error(`Error fetching token image:` + error.code);
    console.error(error.message);
    console.error(error.response);
    return null;
  }
}

function extractImageUrlFromResponse(response: any): string | null {
  if (response.data && response.data.image && response.data.image.thumb) {
    return response.data.image.thumb;
  } else {
    return null;
  }
}
