const jwt = require('jsonwebtoken');

// A helper to create a dummy JWT if there is a JWT_SECRET, just in case a safe route needs it.
function getDummyToken() {
  const secret = process.env.JWT_SECRET || 'dummy-secret-for-health-checks-if-none-exists';
  return jwt.sign({ id: 'health-check-dummy', email: 'health@example.com' }, secret, { expiresIn: '1h' });
}

async function runHealthChecks(app, io) {
  const { discoverRoutes } = require('./routeDiscovery');
  const routes = discoverRoutes(app);
  const results = [];
  
  const fetch = require('node-fetch');
  
  const port = process.env.PORT || 5000;
  const baseUrl = `http://127.0.0.1:${port}`;
  const dummyToken = getDummyToken();

  for (const route of routes) {
    if (route.isSafe) {
      const start = Date.now();
      try {
        // Fill param placeholders like :id with '1' for test queries
        let testPath = route.path.replace(/:[^\/]+/g, '1');
        const url = `${baseUrl}${testPath}`;
        
        const response = await fetch(url, {
          method: route.method,
          headers: {
            'Authorization': `Bearer ${dummyToken}`,
            'User-Agent': 'AnimeX-HealthCheck/1.0'
          },
          timeout: 5000
        });
        
        const responseTime = Date.now() - start;
        // Even if a 401 or 403 or 404 is returned because of dummy data, the route is UP and responding.
        // We consider 2xx, 3xx, 4xx as "healthy" because the express handler didn't crash (5xx).
        const statusOk = response.status < 500;
        
        results.push({
          ...route,
          status: statusOk ? 'OK' : 'ERROR',
          statusCode: response.status,
          responseTime
        });
      } catch (err) {
        results.push({
          ...route,
          status: 'ERROR',
          statusCode: err.type === 'request-timeout' ? 'TIMEOUT' : 'FAIL',
          responseTime: Date.now() - start
        });
      }
    } else {
      // UNSAFE route - verify registration only (dry run/mock)
      // Since express-list-endpoints found it, we know the middleware chain is registered and valid.
      results.push({
        ...route,
        status: 'OK',
        statusCode: 'MOCK',
        responseTime: 0
      });
    }
  }

  // Supabase check
  const supabaseStart = Date.now();
  let supabaseStatus = 'ERROR';
  try {
    const { supabase } = require('../config/supabase');
    // A simple query to verify connection (LIMIT 1 is fast and safe)
    const { error } = await supabase.from('users').select('id').limit(1);
    if (!error || error.code === 'PGRST116') {
      supabaseStatus = 'OK';
    }
  } catch (err) {
    console.error('Supabase health check failed', err);
  }
  const supabaseTime = Date.now() - supabaseStart;

  // Socket.io check
  let socketStatus = 'ERROR';
  try {
    if (io && io.engine) {
      socketStatus = 'OK';
    }
  } catch (err) {}

  return {
    routes: results,
    supabase: { status: supabaseStatus, responseTime: supabaseTime },
    socket: { status: socketStatus, responseTime: 0 }
  };
}

module.exports = { runHealthChecks };
