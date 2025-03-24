jest.mock('./src/metrics', () => ({
  requestTracker: (req, res, next) => next(),
  trackDbQuery: () => {},
  trackDbConnectionError: () => {},
  updateDbPoolMetrics: () => {},
  getMetrics: () => ({}),
  recordUserSignup: () => {},
  recordUserActivity: () => {}, 
  recordAuthAttempt: () => {},
  recordPizzaSale: () => {}
}));

jest.mock('./src/logger', () => ({
  httpLogger: jest.fn((req, res, next) => next()),
  dbLogger: jest.fn(),
  factoryLogger: jest.fn(),
  errorLogger: jest.fn((err, req, res, next) => next(err)),
  log: jest.fn(),
  statusToLogLevel: jest.fn(() => 'info'),
  truncateSql: jest.fn(sql => sql),
  nowString: jest.fn(() => '1000000000000000'),
  sanitize: jest.fn(data => JSON.stringify(data)),
  sendLogToGrafana: jest.fn()
}));