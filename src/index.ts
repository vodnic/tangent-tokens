import express from 'express';
import log4js from 'log4js';
import { getToken } from './tokens';
import dotenv from 'dotenv';
import { bulkUpdateTokensInDb } from './bulkUpdate';
import { CacheDuration, withCache } from 'tangent-utils';
import { Web3Current, DbPool } from 'tangent-utils';

dotenv.config();
log4js.configure('log4js.json');

const logger = log4js.getLogger('Index');
const APP_PORT = process.env.MS_TOKENS_PORT || 3000;
const app = express();

app.listen(APP_PORT, async () => {
  logger.info('Server is listening on port ' + APP_PORT);
});

app.get('/token/:tokenAddress', async (req, res) => {
  const tokenAddress = req.params.tokenAddress;
  try {
    logger.info(`Fetching token ${tokenAddress}`);
    const token = await withCache("getToken", CacheDuration.ONE_HOUR, getToken, [tokenAddress]);
    res.status(200);
    res.send(token);
  } catch (e) {
    res.status(400);
    res.send({ error: e.message });
  }
});

app.get('/status', async (req, res) => {
  logger.info(`Fetching status`);
  let dbStatus = 'OK';
  try {
    DbPool().healthCheck();
  } catch (e) {
    dbStatus = 'ERROR';
  }

  let web3Status = 'OK';
  try {
    Web3Current().healthCheck();
  } catch (e) {
    web3Status = 'ERROR';
  }

  res.status(200);
  const status = (dbStatus === 'OK' && web3Status === 'OK') ? 'OK' : 'NOK';
  res.send({ 
    status: status,
    dbStatus: dbStatus,
    web3Status: web3Status
  });
});

bulkUpdateTokensInDb();
setInterval(() => { bulkUpdateTokensInDb(); }, 3600000);
