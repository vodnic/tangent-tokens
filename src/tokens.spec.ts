import Web3 from "web3";
import { Pool } from "pg";
import { Token } from "tangent-utils";
import BigNumber from "bignumber.js";
import * as coingeckoClient from "./coingeckoClinet";
import * as persistance from "./persistance";
import { Contract } from 'web3-eth-contract';
import * as tangentUtils from 'tangent-utils';

jest.mock("log4js", () => ({
  configure: jest.fn(),
  getLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("pg", () => ({
  Pool: jest.fn(() => ({
    connect: jest.fn(),
  })),
}));

// Mock the functions imported from other modules
jest.mock("./coingeckoClinet", () => ({
  getCoingeckoCoinPrice: jest.fn(),
  getCoingeckoTokenPrice: jest.fn(),
}));

jest.mock("./persistance", () => ({
  fetchTokenDataFromDb: jest.fn(),
  updateTokenInDb: jest.fn(),
}));

const mockWeb3Mock = {
  utils: {
    isAddress: Web3.utils.isAddress,
  },
};

const { Contracts } = tangentUtils;
jest.mock('tangent-utils', () => {
  const originalTangentUtils = jest.requireActual('tangent-utils');
  return {
    ...originalTangentUtils,
    Web3Current: jest.fn(), // <-- Update here
    Contracts: {
      ...originalTangentUtils.Contracts,
      ERC20: jest.fn(),
    },
  };
});

(tangentUtils.Web3Current as jest.Mock).mockImplementation(() => mockWeb3Mock);
import { getToken } from "./tokens";

describe("tokens.ts", () => {
  const dummyTokenAddress = "0x1234567890123456789012345678901234567890";
  const dummyToken: Token = {
    address: dummyTokenAddress,
    name: "Dummy",
    symbol: "DMY",
    decimals: 18,
    price: null,
    lastUpdated: new Date(),
    image: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (tangentUtils.Web3Current as jest.Mock).mockImplementation(() => mockWeb3Mock);
  });

  test("getToken - throws an error when provided an invalid token address", async () => {
    const invalidAddress = "0xThisIsNotAValidAddress";

    getToken(invalidAddress).catch((error) => {
      expect(error.message).toEqual(`Invalid token address: ${invalidAddress}`);
    });
  });

  test("getToken - returns a token from the database when it exists and the price is not expired", async () => {
    (persistance.fetchTokenDataFromDb as jest.Mock).mockImplementation(() => Promise.resolve(dummyToken));

    const result = await getToken(dummyTokenAddress);
    expect(result).toEqual(dummyToken);
    expect(persistance.fetchTokenDataFromDb).toHaveBeenCalledWith(dummyTokenAddress);
  });

  test("getToken - returns a token with updated price when it exists in the database but the price is expired", async () => {
    const expiredToken = { ...dummyToken, lastUpdated: new Date(Date.now() - 101 * 60 * 60 * 1000) }; // Token price expired 101 hours ago
    const updatedPrice = "100";
    const expectedToken = { ...expiredToken, price: updatedPrice };

    (persistance.fetchTokenDataFromDb as jest.Mock).mockImplementation(() => Promise.resolve(expiredToken));
    (coingeckoClient.getCoingeckoTokenPrice as jest.Mock).mockImplementation(() => Promise.resolve(updatedPrice));

    const result = await getToken(dummyTokenAddress);

    expect(result).toEqual(expectedToken);
    expect(persistance.fetchTokenDataFromDb).toHaveBeenCalledWith(dummyTokenAddress);
    expect(coingeckoClient.getCoingeckoTokenPrice).toHaveBeenCalledWith(dummyTokenAddress);
    expect(persistance.updateTokenInDb).toHaveBeenCalledWith(expectedToken);
  });

  test("getToken - fetches live data and returns a token when it doesn't exist in the database", async () => {
    const liveTokenPrice = new BigNumber(200);
    const erc20ContractMock: Partial<Contract> = {
      methods: {
        name: jest.fn(() => ({ call: jest.fn(() => Promise.resolve("Dummy")) })),
        symbol: jest.fn(() => ({ call: jest.fn(() => Promise.resolve("DMMY")) })),
        decimals: jest.fn(() => ({ call: jest.fn(() => Promise.resolve(18)) })),
      },
    };

    (persistance.fetchTokenDataFromDb as jest.Mock).mockImplementation(() => Promise.resolve(null));
    (coingeckoClient.getCoingeckoCoinPrice as jest.Mock).mockImplementation(() => Promise.resolve(liveTokenPrice));
    (coingeckoClient.getCoingeckoTokenPrice as jest.Mock).mockImplementation(() => Promise.resolve(liveTokenPrice));
    (persistance.updateTokenInDb as jest.Mock).mockImplementation(() => {});
    (Contracts.ERC20 as jest.Mock).mockImplementation(() => erc20ContractMock);

    const result = await getToken(dummyTokenAddress);

    expect(result.address).toEqual(dummyTokenAddress);
    expect(result.price).toEqual(liveTokenPrice);
    expect(result.name).toEqual("Dummy");
    expect(result.symbol).toEqual("DMMY");
    expect(result.decimals).toEqual(18);
    expect(persistance.fetchTokenDataFromDb).toHaveBeenCalledWith(dummyTokenAddress);
    expect(coingeckoClient.getCoingeckoTokenPrice).toHaveBeenCalledWith(dummyTokenAddress);
    expect(persistance.updateTokenInDb).toHaveBeenCalled();
  });

});
