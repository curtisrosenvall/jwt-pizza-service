jest.mock('./src/metrics', () => ({
    requestTracker: jest.fn((req, res, next) => next()),
    trackDbQuery: jest.fn(),
    getMetrics: jest.fn(() => ({})),
    recordUserSignup: jest.fn()
  }));