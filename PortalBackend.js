const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const { createConnections } = require('./SocialConnections');

// Single-process local storage. Keep this directory outside public static assets.
const dataDir = process.env.PORTAL_DATA_DIR || path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'portal.json');
const sessions = new Map();
const attempts = new Map();
const sessionLifetime = 12 * 60 * 60 * 1000;
const appOrigin = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).origin : null;
const secureCookie = appOrigin?.startsWith('https://');

function readDb() {
    try {
        const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
        if (!Array.isArray(db.users)) throw Error('Invalid portal database');
        return db;
    } catch (error) {
        if (error.code === 'ENOENT') return { users: [] };
        throw error;
    }
}

function writeDb(db) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(`${dbFile}.tmp`, JSON.stringify(db), { mode: 0o600 });
    fs.renameSync(`${dbFile}.tmp`, dbFile);
}

const connections = createConnections({ dataDir, readDb, writeDb });
const connectionAttempts = new Map();

function connectionThrottle(userId) {
    const now = Date.now();
    for (const [id, value] of connectionAttempts) if (value.until < now) connectionAttempts.delete(id);
    const value = connectionAttempts.get(userId) || { count: 0, until: now + 60000 };
    value.count++;
    connectionAttempts.set(userId, value);
    if (value.count > 10) throw fail(429, 'Too many connection checks. Wait a minute and try again.');
}

function reply(res, code, data) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
}

function fail(code, message) { return Object.assign(Error(message), { status: code }); }

async function readBody(req) {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw fail(415, 'Send JSON data.');
    let length = 0;
    const chunks = [];
    for await (const chunk of req) {
        length += chunk.length;
        if (length > 64_000) throw fail(413, 'Request is too large.');
        chunks.push(chunk);
    }
    try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
        return body;
    } catch { throw fail(400, 'Invalid request data.'); }
}

function cookie(res, token, age) {
    res.setHeader('Set-Cookie', `portal_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secureCookie ? '; Secure' : ''}`);
}

function getSession(req) {
    const token = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('portal_session='))?.slice(15);
    const session = sessions.get(token);
    if (session && session.expires > Date.now()) return { ...session, token };
    sessions.delete(token);
    return null;
}

function newSession(req, res, user) {
    const previous = getSession(req);
    if (previous) sessions.delete(previous.token);
    for (const [token, session] of sessions) if (session.expires <= Date.now()) sessions.delete(token);
    const token = crypto.randomBytes(32).toString('hex');
    const csrf = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { userId: user.id, csrf, expires: Date.now() + sessionLifetime });
    cookie(res, token, sessionLifetime / 1000);
    return { authenticated: true, username: user.username, csrf };
}

function throttle(req) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    const key = req.socket.remoteAddress;
    const value = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    value.count++;
    attempts.set(key, value);
    if (value.count > 20) throw fail(429, 'Too many sign-in attempts. Try again in 15 minutes.');
}

function settingsFrom(body) {
    const result = {};
    const hosts = { telegram: ['t.me', 'telegram.me'], facebook: ['facebook.com', 'www.facebook.com'], instagram: ['instagram.com', 'www.instagram.com'] };
    for (const name of ['telegram', 'facebook', 'instagram', 'whatsapp', 'other']) {
        const value = body[name] ?? '';
        if (typeof value !== 'string' || value.length > (name === 'other' ? 2000 : 300)) throw fail(400, `Invalid ${name} value.`);
        result[name] = value.trim();
        if (hosts[name] && result[name]) {
            let url;
            try { url = new URL(result[name]); } catch { throw fail(400, `Enter a valid ${name} link.`); }
            if (url.protocol !== 'https:' || !hosts[name].includes(url.hostname) || url.username || url.password || url.port) throw fail(400, `Use an official HTTPS ${name} link.`);
        }
    }
    result.whatsappType = body.whatsappType ?? 'channel';
    if (!['channel', 'business'].includes(result.whatsappType)) throw fail(400, 'Invalid WhatsApp destination.');
    for (const name of ['useFacebook', 'useInstagram', 'useWhatsapp']) {
        if (body[name] !== undefined && typeof body[name] !== 'boolean') throw fail(400, 'Invalid destination selection.');
        result[name] = body[name] === true;
    }
    return result;
}

async function handlePortal(req, res, pathname) {
    try {
        // JSON-only writes plus origin and per-session CSRF validation.
        if (!['GET', 'HEAD'].includes(req.method)) {
            const expected = appOrigin || `http://${req.headers.host}`;
            if (req.headers.origin && req.headers.origin !== expected) throw fail(403, 'Request origin is not allowed.');
            if (req.headers['sec-fetch-site'] === 'cross-site') throw fail(403, 'Cross-site request is not allowed.');
        }
        const session = getSession(req);
        if (pathname === '/api/portal/session' && req.method === 'GET') {
            const user = session && readDb().users.find(item => item.id === session.userId);
            return reply(res, 200, user ? { authenticated: true, username: user.username, csrf: session.csrf } : { authenticated: false });
        }
        if (['/api/portal/register', '/api/portal/login'].includes(pathname) && req.method === 'POST') {
            throttle(req);
            const body = await readBody(req);
            const username = typeof body.username === 'string' ? body.username.toLowerCase().trim() : '';
            if (!/^[a-z0-9_-]{3,32}$/.test(username) || typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) {
                throw fail(400, 'Use a username of 3–32 letters/numbers and a portal password of 12–128 characters.');
            }
            if (pathname.endsWith('/register')) {
                const salt = crypto.randomBytes(16).toString('hex');
                const hash = (await scrypt(body.password, salt, 64)).toString('hex');
                // Read after hashing so overlapping registrations cannot overwrite each other.
                const db = readDb();
                if (db.users.some(user => user.username === username)) throw fail(409, 'This username is already taken.');
                const user = { id: crypto.randomUUID(), username, salt, hash, settings: {}, draft: '', createdAt: new Date().toISOString() };
                db.users.push(user);
                writeDb(db);
                return reply(res, 201, newSession(req, res, user));
            }
            const user = readDb().users.find(item => item.username === username);
            const actual = await scrypt(body.password, user?.salt || 'missing-account', 64);
            if (!user || !crypto.timingSafeEqual(actual, Buffer.from(user.hash, 'hex'))) throw fail(401, 'Username or password is incorrect.');
            return reply(res, 200, newSession(req, res, user));
        }
        if (!session) throw fail(401, 'Sign in to your portal account first.');
        if (req.headers['x-csrf-token'] !== session.csrf) throw fail(403, 'Refresh the page and try again.');
        if (pathname === '/api/portal/logout' && req.method === 'POST') {
            sessions.delete(session.token);
            cookie(res, '', 0);
            return reply(res, 200, { ok: true });
        }
        if (pathname.startsWith('/api/portal/connections')) {
            const match = pathname.match(/^\/api\/portal\/connections(?:\/([a-f0-9-]{36})(\/check)?)?$/);
            if (!match) return reply(res, 404, { error: 'Not found' });
            const [, id, checking] = match;
            if (!id && req.method === 'GET') return reply(res, 200, { connections: connections.list(session.userId) });
            if (req.method === 'POST') {
                // Credential submission is supported over HTTPS, or loopback for local development.
                const host = (req.headers.host || '').replace(/:\d+$/, '');
                if (!secureCookie && !( ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && ['localhost', '127.0.0.1', '[::1]'].includes(host) )) throw fail(400, 'Use HTTPS before entering social access tokens.');
                connectionThrottle(session.userId);
                const authorized = () => sessions.get(session.token)?.csrf === session.csrf && session.expires > Date.now();
                if (!id) return reply(res, 201, { connection: await connections.save(session.userId, await readBody(req), authorized) });
                if (checking) return reply(res, 200, { connection: await connections.check(session.userId, id, authorized) });
            }
            if (id && !checking && req.method === 'DELETE') {
                await connections.remove(session.userId, id);
                return reply(res, 200, { removed: true });
            }
            return reply(res, 404, { error: 'Not found' });
        }
        // Await request bodies before reading the latest database snapshot.
        const body = req.method === 'PUT' ? await readBody(req) : null;
        const db = readDb();
        const user = db.users.find(item => item.id === session.userId);
        if (!user) throw fail(401, 'Sign in again.');
        if (pathname === '/api/portal/settings') {
            if (req.method === 'GET') return reply(res, 200, { settings: user.settings });
            if (req.method === 'PUT') {
                user.settings = settingsFrom(body);
                writeDb(db);
                return reply(res, 200, { settings: user.settings });
            }
        }
        if (pathname === '/api/portal/draft') {
            if (req.method === 'GET') return reply(res, 200, { draft: user.draft });
            if (req.method === 'PUT') {
                if (typeof body.draft !== 'string' || body.draft.length > 10000) throw fail(400, 'Draft must be at most 10,000 characters.');
                user.draft = body.draft;
                writeDb(db);
                return reply(res, 200, { saved: true });
            }
        }
        if (pathname === '/api/portal/history' && req.method === 'GET') {
            // No publishers are connected yet; never invent delivery results.
            return reply(res, 200, { posts: [], publishingEnabled: false });
        }
        return reply(res, 404, { error: 'Not found' });
    } catch (error) {
        return reply(res, error.status || 500, { error: error.status ? error.message : 'Could not complete the request. Please try again.' });
    }
}

module.exports = { handlePortal };
