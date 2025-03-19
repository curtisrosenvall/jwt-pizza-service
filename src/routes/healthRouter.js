// routes/healthRouter.js

const express = require('express');
const { getMetrics } = require('../metrics');
const router = express.Router();
const version = require('../version.json');

// Define the router endpoints for documentation
router.endpoints = [
  {
    method: 'GET',
    path: '/api/health/status',
    description: 'Get service health status',
    auth: false
  },
  {
    method: 'GET',
    path: '/api/health/metrics',
    description: 'Get detailed service metrics',
    auth: false
  }
];

// Basic health check endpoint
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    version: version.version,
    timestamp: new Date().toISOString()
  });
});

// Detailed metrics endpoint
router.get('/metrics', (req, res) => {
  res.json(getMetrics());
});

module.exports = router;