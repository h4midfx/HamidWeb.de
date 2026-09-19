const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');

test('portal accounts isolate persistent settings and drafts, protect sessions, and never claim publishing', { timeout: 30000 }, async t => {
    const root = path.join(__dirname, '..');
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'hamid-portal-test-'));
    const probe = net.createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    let server;
    async function stop() {
        if (!server || server.exitCode !== null) return;
        const stopped = new Promise(resolve => server.once('exit', resolve));
        server.kill();
        await stopped;
    }
    async function start() {
        server = spawn(process.execPath, ['server.js'], {
            cwd: root, env: { ...process.env, APP_ORIGIN: '', PORT: String(port), PORTAL_DATA_DIR: data },
            windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
        });
        await new Promise((resolve, reject) => {
            server.stdout.once('data', resolve);
            server.once('error', reject);
            server.once('exit', code => reject(Error(`Server exited ${code}`)));
        });
    }
    t.after(async () => {
        await stop();
        // Remove only the exact test-created files and then the empty temp directory.
        for (const file of ['portal.json', 'portal.json.tmp']) {
            const target = path.join(data, file);
            if (fs.existsSync(target)) fs.unlinkSync(target);
        }
        fs.rmdirSync(data);
    });
    await start();
    const origin = `http://127.0.0.1:${port}`;
    async function call(route, { method = 'GET', body, cookie, csrf, headers = {} } = {}) {
        const response = await fetch(`${origin}/api/portal/${route}`, {
            method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {})
        });
        return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
    }
    const credentials = { username: 'alice', password: 'a-long-local-password' };
    assert.equal((await call('settings')).status, 401);
    assert.deepEqual((await call('session')).data, { authenticated: false });
    assert.equal((await call('register', { method: 'POST', body: credentials, headers: { Origin: 'https://untrusted.example' } })).status, 403);
    const alice = await call('register', { method: 'POST', body: credentials });
    assert.equal(alice.status, 201);
    assert.match(alice.cookie, /HttpOnly/);
    assert.match(alice.cookie, /SameSite=Strict/);
    const a = { cookie: alice.cookie.split(';')[0], csrf: alice.data.csrf };
    assert.equal((await call('connections')).status, 401);
    assert.deepEqual((await call('connections', a)).data.connections, []);
    assert.equal((await call('connections', { ...a, csrf: 'wrong', method: 'POST', body: {} })).status, 403);
    assert.equal((await call('connections', { ...a, method: 'POST', body: {} })).status, 400);
    assert.equal((await call('register', { method: 'POST', body: credentials })).status, 409);
    assert.equal((await call('login', { method: 'POST', body: { ...credentials, password: 'incorrect-password' } })).status, 401);
    assert.equal((await call('settings', { ...a, csrf: 'wrong', method: 'PUT', body: {} })).status, 403);
    assert.equal((await call('settings', { ...a, method: 'PUT', body: { telegram: 'https://evil.example/channel' } })).status, 400);
    const settings = { telegram: 'https://t.me/alice_channel', facebook: 'https://www.facebook.com/alice_page', useFacebook: true, whatsappType: 'channel' };
    assert.equal((await call('settings', { ...a, method: 'PUT', body: settings })).status, 200);
    const draft = 'Exact text  \n<script>not executed</script>\n\u0633\u0644\u0627\u0645';
    assert.equal((await call('draft', { ...a, method: 'PUT', body: { draft } })).status, 200);
    assert.equal((await call('draft', { ...a, method: 'PUT', body: { draft: 'x'.repeat(10001) } })).status, 400);
    const bob = await call('register', { method: 'POST', body: { username: 'bob', password: 'another-long-password' } });
    const b = { cookie: bob.cookie.split(';')[0], csrf: bob.data.csrf };
    assert.deepEqual((await call('settings', b)).data.settings, {});
    assert.equal((await call('draft', b)).data.draft, '');
    assert.equal((await call('settings', { ...b, csrf: a.csrf })).status, 403);
    assert.equal((await call('draft', a)).data.draft, draft);
    assert.deepEqual((await call('history', a)).data, { posts: [], publishingEnabled: false });
    assert.equal((await fetch(`${origin}/data/portal.json`)).status, 404);
    assert.equal((await fetch(`${origin}/PortalBackend.js`)).status, 404);
    assert.equal((await fetch(`${origin}/SocialConnections.js`)).status, 404);
    assert.equal((await fetch(`${origin}/data/connections.key`)).status, 404);
    const stored = fs.readFileSync(path.join(data, 'portal.json'), 'utf8');
    assert.ok(!stored.includes(credentials.password));
    assert.ok(!stored.includes(a.cookie.slice(15)));
    assert.equal((await call('logout', { ...b, method: 'POST', body: {} })).status, 200);
    assert.equal((await call('draft', b)).status, 401);
    await stop();
    await start();
    assert.equal((await call('settings', a)).status, 401);
    const login = await call('login', { method: 'POST', body: credentials });
    assert.equal(login.status, 200);
    const fresh = { cookie: login.cookie.split(';')[0], csrf: login.data.csrf };
    assert.equal((await call('settings', fresh)).data.settings.telegram, settings.telegram);
    assert.equal((await call('draft', fresh)).data.draft, draft);
});
