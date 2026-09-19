const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

test('remaining website pages load and private files stay inaccessible', { timeout: 15000 }, async t => {
    const probe = net.createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const server = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(port) },
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    t.after(async () => {
        server.kill();
        await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
    });
    await new Promise((resolve, reject) => {
        server.stdout.once('data', resolve);
        server.once('error', reject);
        server.once('exit', code => reject(Error(`Server exited ${code}`)));
    });
    const origin = `http://127.0.0.1:${port}`;
    for (const asset of ['Games.html', 'Games.css', 'Games.js']) {
        const response = await fetch(`${origin}/${asset}`);
        assert.equal(response.status, 200, asset);
        assert.ok((await response.text()).length > 0);
    }
    for (const route of ['/', '/index.html', '/Index.html', '/Index.css', '/Index.Js', '/HamidCalculator.html', '/CryptoSignals.html', '/CryptoSignals.css', '/CryptoSignals.js', '/SignalMarket.js', '/RandomPositions.js', '/RandomPositions.css', '/SignalScanner.js', '/SignalScanner.css', '/SignalEngine.js', '/SocialPortal.html', '/SocialPortal.css', '/SocialPortal.js']) {
        const response = await fetch(origin + route);
        assert.equal(response.status, 200, route);
        assert.ok((await response.text()).length > 0, route);
    }
    const home = await (await fetch(origin)).text();
    assert.match(home, /SocialPortal.html/);
    const health = await (await fetch(origin + '/api/health')).json();
    assert.deepEqual(health, { ok: true, service: 'hamid-tools' });
    for (const route of ['/server.js', '/package.json', '/.env', '/.git/config', '/missing.html']) {
        assert.equal((await fetch(origin + route)).status, 404, route);
    }
    assert.equal((await fetch(origin + '/api/auth/login', { method: 'POST' })).status, 404);
});
