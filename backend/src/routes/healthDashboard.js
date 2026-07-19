const express = require('express');
const router = express.Router();
const { renderDashboard } = require('../health/healthDashboard');

// Restrict to localhost/dev or basic auth in production
function restrictAccess(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    const authHeader = req.headers.authorization;
    // Default pass is 'admin' if HEALTH_PASS is not set
    const expectedAuth = 'Basic ' + Buffer.from('admin:' + (process.env.HEALTH_PASS || 'admin')).toString('base64');
    
    if (!authHeader || authHeader !== expectedAuth) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Health Dashboard"');
      return res.status(401).send('Unauthorized');
    }
  }
  next();
}

router.get('/', restrictAccess, renderDashboard);

module.exports = router;
