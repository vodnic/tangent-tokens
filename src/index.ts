import express from 'express';
import log4js from 'log4js';
import { getToken } from './tokens';
import dotenv from 'dotenv';
import { bulkUpdateTokensInDb } from './bulkUpdate';
import { DbPool } from 'tangent-utils';

const app = express();
dotenv.config();

const PORT = process.env.MS_TOKENS_PORT || 3000;

const dbPool = DbPool();

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

app.listen(PORT, async () => {
  logger.info('Server is listening on port ' + PORT);
});

bulkUpdateTokensInDb(dbPool)
setInterval(() => { bulkUpdateTokensInDb(dbPool); }, 3600000);