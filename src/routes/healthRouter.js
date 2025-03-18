const express = require('express');
const metrics = require('../metrics');
const { DB } = require('../database/database.js');
const version = require('../version.json');

const healthRouter = express.Router();

healthRouter.endpoints = [
  {
    method: 'GET',
    path: '/api/health',
    description: 'Get service health status',
    example: `curl localhost:3000/api/health`,
    response: { status: 'healthy', version: '20240101.123456', uptime: '10m 30s' },
  },
  {
    method: 'GET',
    path: '/api/health/metrics',
    description: 'Get service metrics',
    example: `curl localhost:3000/api/health/metrics`,
    response: { system: {}, http: {}, database: {} },
  }
];

// Basic health check
healthRouter.get('/', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = await checkDatabaseConnection();
    
    res.json({
      status: dbStatus ? 'healthy' : 'degraded',
      version: version.version,
      uptime: formatUptime(process.uptime()),
      database: dbStatus ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      version: version.version,
      uptime: formatUptime(process.uptime()),
      error: error.message
    });
  }
});

// Metrics endpoint
healthRouter.get('/metrics', (req, res) => {
  res.json(metrics.getMetrics());
});

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

// Check database connection
async function checkDatabaseConnection() {
  try {
    const connection = await DB.getConnection();
    connection.end();
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

module.exports = healthRouter; 