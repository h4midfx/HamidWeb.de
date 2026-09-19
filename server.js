const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handlePortal } = require('./PortalBackend');

const PORT = Number(process.env.PORT) || 3000;
const publicFiles = new Set([
    'index.html', 'Index.css', 'Index.Js', 'HamidCalculator.html',
    'CryptoSignals.html', 'SignalEngine.js', 'SignalMarket.js', 'RandomPositions.js', 'RandomPositions.css', 'SignalScanner.js', 'SignalScanner.css', 'CryptoSignals.js', 'CryptoSignals.css', 'SocialPortal.html', 'SocialPortal.css', 'SocialPortal.js'
]);

function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
    try {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname.startsWith('/api/portal/')) return handlePortal(req, res, url.pathname);
        if (req.method === 'GET' && url.pathname === '/api/health') {
            return json(res, 200, { ok: true, service: 'hamid-tools' });
        }
        const asset = ['/', '/index.html', '/Index.html'].includes(url.pathname) ? 'index.html' : url.pathname.slice(1);
        // Serve only explicitly listed public assets, never server source or private files.
        if (['GET', 'HEAD'].includes(req.method) && publicFiles.has(asset)) {
            const body = fs.readFileSync(path.join(__dirname, asset));
            const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }[path.extname(asset).toLowerCase()];
            res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache' });
            return res.end(req.method === 'HEAD' ? undefined : body);
        }
        return json(res, 404, { error: 'Not found' });
    } catch {
        return json(res, 500, { error: 'Internal server error' });
    }
});
server.listen(PORT, () => console.log(`Hamid Tools running at http://localhost:${PORT}`));
