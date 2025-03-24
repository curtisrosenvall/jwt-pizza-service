

const express = require('express');
const { getMetrics } = require('../metrics');
const router = express.Router();
const version = require('../version.json');


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


router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    version: version.version,
    timestamp: new Date().toISOString()
  });
});


router.get('/metrics', (req, res) => {
  res.json(getMetrics());
});

module.exports = router;