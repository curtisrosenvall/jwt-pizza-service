jest.mock('./src/metrics', () => ({
  requestTracker: (req, res, next) => next(),
  trackDbQuery: () => {},
  trackDbConnectionError: () => {},
  updateDbPoolMetrics: () => {},
  getMetrics: () => ({}),
  recordUserSignup: () => {},
  recordUserActivity: () => {}, // Make sure this is mocked
  recordAuthAttempt: () => {},
  recordPizzaSale: () => {}
}));