import dotenv from "dotenv";
import Web3 from "web3";
import log4js from "log4js";
import { Pool } from "pg";
import { AbiItem } from "web3-utils";
import _erc20ABI from "./abis/erc20ABI.json";

const erc20ABI = _erc20ABI as AbiItem[];

dotenv.config();

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.ethereumNodeUrl));

log4js.configure('log4js.json');
const logger = log4js.getLogger('Tokens');

interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

export async function getToken(dbPool: Pool, tokenAddress: string): Promise<Token> {
  const tokenContract = new web3.eth.Contract(erc20ABI, tokenAddress);
  const name = await tokenContract.methods.name().call();
  const symbol = await tokenContract.methods.symbol().call();
  const decimals = await tokenContract.methods.decimals().call();

  const token: Token = {
    address: tokenAddress,
    name: name,
    symbol: symbol,
    decimals: decimals,
  };

  return token;
}