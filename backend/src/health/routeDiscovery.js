const listEndpoints = require('express-list-endpoints');

function discoverRoutes(app) {
  const endpoints = listEndpoints(app);
  const discovered = [];

  endpoints.forEach((endpoint) => {
    endpoint.methods.forEach((method) => {
      const upperMethod = method.toUpperCase();
      const isSafe = ['GET', 'HEAD', 'OPTIONS'].includes(upperMethod);
      
      discovered.push({
        path: endpoint.path,
        method: upperMethod,
        isSafe,
        middlewares: endpoint.middlewares
      });
    });
  });

  // Sort alphabetically by path for cleaner viewing
  discovered.sort((a, b) => a.path.localeCompare(b.path));

  return discovered;
}

module.exports = { discoverRoutes };
