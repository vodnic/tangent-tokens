import express from 'express';
import log4js from 'log4js';
import { getToken } from './tokens';
import { Pool } from 'pg';

const app = express();

const dbPool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

log4js.configure('log4js.json');
const logger = log4js.getLogger('index.ts');

app.get('/token/:tokenAddress', async (req, res) => {
  res.send("pong");
});

app.listen(3000, () => {
  logger.info('Server is listening on port 3000');
});

const tokenAddress = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'; // WBTC
getToken(dbPool, tokenAddress).then((token) => {console.log(token)});