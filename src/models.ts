import { BigNumber } from 'bignumber.js';

export interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  price: BigNumber;
  lastUpdated: Date;
}