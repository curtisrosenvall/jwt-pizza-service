const express = require('express');
const { authRouter, setAuthUser } = require('./routes/authRouter.js');
const orderRouter = require('./routes/orderRouter.js');
const franchiseRouter = require('./routes/franchiseRouter.js');
const healthRouter = require('./routes/healthRouter.js');
const metrics = require('./metrics');
const version = require('./version.json');
const { trackAuthSuccess, trackTokenValidation, trackAuth} = require('./authMiddleware');
const config = require('./config.js');
require('./database/databaseWrapper');
const logger = require('./logger.js');


const app = express();

app.use(metrics.requestTracker);

app.use(trackAuth);
app.use(trackTokenValidation); 
app.use(trackAuthSuccess);     

app.use(logger.httpLogger);





app.use(setAuthUser);
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

const apiRouter = express.Router();
app.use('/api', apiRouter);

apiRouter.use('/auth', authRouter);
apiRouter.use('/order', orderRouter);
apiRouter.use('/franchise', franchiseRouter);
apiRouter.use('/health', healthRouter);

apiRouter.use('/docs', (req, res) => {
  res.json({
    version: version.version,
    endpoints: [
      ...authRouter.endpoints, 
      ...orderRouter.endpoints, 
      ...franchiseRouter.endpoints,
      ...healthRouter.endpoints
    ],
    config: { factory: config.factory.url, db: config.db.connection.host },
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'welcome to JWT Pizza',
    version: version.version,
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    message: 'unknown endpoint',
  });
});

app.use(logger.errorLogger);



app.use((err, req, res, next) => {
  res.status(err.statusCode ?? 500).json({ message: err.message, stack: err.stack });
  next();
});

logger.log('info', 'system', {
  message: 'JWT Pizza API service started',
  version: version.version,
  environment: process.env.NODE_ENV || 'development'
});

module.exports = app;