const { runHealthChecks } = require('./checkRunner');

async function renderDashboard(req, res) {
  // Pass req.app to get the router stack, and req.app.get('io') to check socket
  const checks = await runHealthChecks(req.app, req.app.get('io'));
  
  const totalRoutes = checks.routes.length;
  const healthyRoutes = checks.routes.filter(r => r.status === 'OK').length;
  
  const getStatusColor = (status, responseTime) => {
    if (status !== 'OK') return '#fca5a5'; // Red for error
    if (responseTime > 1000) return '#fef08a'; // Yellow for slow
    return '#bbf7d0'; // Green for success
  };

  const getStatusIcon = (status) => status === 'OK' ? '✓' : '✗';

  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="refresh" content="30">
      <title>AnimeX Health Dashboard</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 2rem; background: #f8fafc; color: #1e293b; }
        h1 { color: #0f172a; margin-bottom: 0.5rem; }
        .summary { background: #fff; padding: 1rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; display: flex; gap: 2rem; flex-wrap: wrap; }
        .summary-item { display: flex; flex-direction: column; }
        .summary-label { font-size: 0.875rem; color: #64748b; text-transform: uppercase; font-weight: 600; }
        .summary-value { font-size: 1.5rem; font-weight: 700; color: #0f172a; }
        .healthy { color: #16a34a; }
        .unhealthy { color: #dc2626; }
        table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; font-weight: 600; color: #475569; }
        tr:last-child td { border-bottom: none; }
        .method { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.875rem; font-weight: 600; background: #e2e8f0; }
        .method.get { background: #dbeafe; color: #1e40af; }
        .method.post { background: #dcfce7; color: #166534; }
        .method.put { background: #fef9c3; color: #854d0e; }
        .method.delete { background: #fee2e2; color: #991b1b; }
        .status-cell { font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>AnimeX Endpoint Health Dashboard</h1>
      <div class="summary">
        <div class="summary-item">
          <span class="summary-label">Endpoints Healthy</span>
          <span class="summary-value ${healthyRoutes === totalRoutes ? 'healthy' : 'unhealthy'}">${healthyRoutes} / ${totalRoutes}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Supabase Connection</span>
          <span class="summary-value ${checks.supabase.status === 'OK' ? 'healthy' : 'unhealthy'}">${checks.supabase.status} (${checks.supabase.responseTime}ms)</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Socket.io Status</span>
          <span class="summary-value ${checks.socket.status === 'OK' ? 'healthy' : 'unhealthy'}">${checks.socket.status}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Last Checked</span>
          <span class="summary-value" style="font-size: 1rem; margin-top: 0.5rem;">${new Date().toLocaleTimeString()}</span>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Status</th>
            <th>Code</th>
            <th>Response Time</th>
          </tr>
        </thead>
        <tbody>
  `;

  checks.routes.forEach(route => {
    const bgColor = getStatusColor(route.status, route.responseTime);
    const mClass = route.method.toLowerCase();
    
    html += `
      <tr style="background-color: ${bgColor}">
        <td><span class="method ${mClass}">${route.method}</span></td>
        <td style="font-family: monospace;">${route.path}</td>
        <td class="status-cell" style="color: ${route.status === 'OK' ? '#166534' : '#991b1b'};">${getStatusIcon(route.status)} ${route.status}</td>
        <td>${route.statusCode}</td>
        <td>${route.responseTime > 0 ? route.responseTime + 'ms' : '-'}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  res.send(html);
}

module.exports = { renderDashboard };
