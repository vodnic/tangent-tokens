import axios from 'axios';
import BigNumber from 'bignumber.js';

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
    throw new Error('No price found');
  }
}