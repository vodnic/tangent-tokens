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
  const tokenAddress = req.params.tokenAddress;
  try {
    const token = await getToken(dbPool, tokenAddress);
    res.status(200);
    res.send(token);
  } catch (e) {
    res.status(400);
    res.send({ error: e.message });
  }
});

app.listen(3000, () => {
  logger.info('Server is listening on port 3000');
});
