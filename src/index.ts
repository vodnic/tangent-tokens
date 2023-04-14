import express from 'express';
import log4js from 'log4js';
import { getToken } from './tokens';
import dotenv from 'dotenv';
import { bulkUpdateTokensInDb } from './bulkUpdate';
import { DbPool } from 'tangent-utils';
import { CacheDuration, withCache } from 'tangent-utils';

dotenv.config();
log4js.configure('log4js.json');

const logger = log4js.getLogger('Index');
const APP_PORT = process.env.MS_TOKENS_PORT || 3000;
const dbPool = DbPool();
const app = express();

app.listen(APP_PORT, async () => {
  logger.info('Server is listening on port ' + APP_PORT);
});

app.get('/token/:tokenAddress', async (req, res) => {
  const tokenAddress = req.params.tokenAddress;
  try {
    logger.info(`Fetching token ${tokenAddress}`);
    const token = await withCache("getToken", CacheDuration.ONE_HOUR, getToken, [dbPool, tokenAddress], [tokenAddress]);
    res.status(200);
    res.send(token);
  } catch (e) {
    res.status(400);
    res.send({ error: e.message });
  }
});

// bulkUpdateTokensInDb(dbPool)
setInterval(() => { bulkUpdateTokensInDb(dbPool); }, 3600000);
