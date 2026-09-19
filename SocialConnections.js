const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const error = (status, message) => Object.assign(Error(message), { status });
const platforms = new Set(['telegram', 'facebook', 'instagram']);

function createConnections({ dataDir, readDb, writeDb, fetchImpl = fetch, encryptionKey = process.env.PORTAL_ENCRYPTION_KEY, graphVersion = process.env.META_GRAPH_VERSION || 'v26.0' }) {
    if (!/^v\d+\.0$/.test(graphVersion)) throw Error('Invalid META_GRAPH_VERSION');
    let cachedKey;
    const busy = new Set();
    function key(create = false) {
        if (cachedKey) return cachedKey;
        if (encryptionKey) {
            if (!/^[a-f\d]{64}$/i.test(encryptionKey)) throw error(503, 'The server encryption key is not configured correctly.');
            cachedKey = Buffer.from(encryptionKey, 'hex');
            return cachedKey;
        }
        const keyFile = path.join(dataDir, 'connections.key');
        try { cachedKey = fs.readFileSync(keyFile); }
        catch (cause) {
            if (cause.code !== 'ENOENT' || !create) throw error(503, 'The saved connection key is unavailable. Contact the site owner.');
            // Never replace a lost key while encrypted credentials already exist.
            if (readDb().users.some(user => user.connections?.length)) throw error(503, 'Restore the saved connection key before reconnecting.');
            fs.mkdirSync(dataDir, { recursive: true });
            const generated = crypto.randomBytes(32);
            try { fs.writeFileSync(keyFile, generated, { flag: 'wx', mode: 0o600 }); }
            catch (failure) { if (failure.code !== 'EEXIST') throw failure; }
            cachedKey = fs.readFileSync(keyFile);
        }
        if (cachedKey.length !== 32) { cachedKey = null; throw error(503, 'The saved connection key is invalid.'); }
        return cachedKey;
    }
    function encrypt(token, owner, connection) {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key(true), iv);
        cipher.setAAD(Buffer.from(`${owner}:${connection.id}:${connection.platform}`));
        const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
        return { iv: iv.toString('base64'), data: data.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
    }
    function decrypt(owner, connection) {
        try {
            const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(connection.secret.iv, 'base64'));
            decipher.setAAD(Buffer.from(`${owner}:${connection.id}:${connection.platform}`));
            decipher.setAuthTag(Buffer.from(connection.secret.tag, 'base64'));
            return Buffer.concat([decipher.update(Buffer.from(connection.secret.data, 'base64')), decipher.final()]).toString('utf8');
        } catch { throw error(503, 'The saved token cannot be opened. Restore the server key or remove and reconnect this account.'); }
    }
    function safe(connection) {
        const { id, platform, accountId, label, status, verifiedAt, checkedAt, createdAt } = connection;
        return { id, platform, accountId, label, status, verifiedAt, checkedAt, createdAt };
    }
    function owner(db, userId) {
        const user = db.users.find(item => item.id === userId);
        if (!user) throw error(401, 'Sign in again.');
        return user;
    }
    async function request(url, options, platform) {
        let response, body;
        try {
            response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(8000) });
            body = await response.json();
        } catch { throw error(502, `${platform} could not be reached. Nothing was published. Try again.`); }
        // Provider errors may echo credentials or request URLs; never forward them.
        if (!response.ok || body.error || body.ok === false) throw error(422, `${platform} rejected the connection. Check the token, account ID and account permissions.`);
        return body;
    }
    async function verify(platform, accountId, token) {
        if (platform === 'telegram') {
            const call = async (method, body = {}) => (await request(`https://api.telegram.org/bot${token}/${method}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            }, 'Telegram')).result;
            const [bot, chat] = await Promise.all([call('getMe'), call('getChat', { chat_id: accountId })]);
            if (!bot?.is_bot || !bot.id || chat?.type !== 'channel') throw error(422, 'Use a valid bot token and a Telegram channel.');
            const membership = await call('getChatMember', { chat_id: chat.id, user_id: bot.id });
            if (!['administrator', 'creator'].includes(membership?.status)) throw error(422, 'Add your bot as an administrator of this channel first.');
            return { accountId: String(chat.id), label: String(chat.title || chat.username || chat.id), botId: String(bot.id) };
        }
        const params = new URLSearchParams({ fields: platform === 'instagram' ? 'id,name,instagram_business_account{id,username}' : 'id,name,category' });
        const page = await request(`https://graph.facebook.com/${graphVersion}/me?${params}`, {
            headers: { Authorization: `Bearer ${token}` }
        }, 'Meta');
        // /me must identify the specified Page, not an unrelated public Page.
        if (String(page.id) !== accountId) throw error(422, 'Use the Page access token belonging to the Page ID you entered.');
        if (platform === 'instagram') {
            const instagram = page.instagram_business_account;
            if (!instagram?.id) throw error(422, 'This Page does not have an accessible linked professional Instagram account.');
            return { accountId: String(instagram.id), pageId: accountId, label: String(instagram.username || page.name || instagram.id) };
        }
        if (!page.category) throw error(422, 'Use a Facebook Page token, not a personal account token.');
        return { accountId: String(page.id), label: String(page.name || page.id) };
    }
    function validate(body) {
        if (!body || !platforms.has(body.platform)) throw error(400, 'Choose Telegram, Facebook or Instagram.');
        if (typeof body.token !== 'string' || !/^[A-Za-z0-9_:.|\-]{20,4096}$/.test(body.token)) throw error(400, 'Enter a valid API access token, not your social-media password.');
        if (typeof body.accountId !== 'string') throw error(400, 'Enter the account ID.');
        const accountId = body.accountId.trim();
        if (body.platform === 'telegram') {
            if (!/^\d{5,20}:[A-Za-z0-9_-]{20,200}$/.test(body.token) || !/^(?:@[A-Za-z0-9_]{5,32}|-100\d{5,20})$/.test(accountId)) throw error(400, 'Enter a Telegram bot token and channel @username or numeric channel ID.');
        } else if (!/^\d{5,30}$/.test(accountId)) throw error(400, 'Enter the numeric Facebook Page ID.');
        return { platform: body.platform, accountId, token: body.token };
    }
    async function locked(userId, work) {
        if (busy.has(userId)) throw error(409, 'Another connection update is running. Please wait and try again.');
        busy.add(userId);
        try { return await work(); } finally { busy.delete(userId); }
    }
    function list(userId) { return (owner(readDb(), userId).connections || []).map(safe); }
    async function save(userId, body, authorized = () => true) {
        const input = validate(body);
        return locked(userId, async () => {
            if ((owner(readDb(), userId).connections || []).length >= 20) throw error(400, 'Remove an unused connection before adding another.');
            const verified = await verify(input.platform, input.accountId, input.token);
            if (!authorized()) throw error(401, 'Your session ended. Sign in and try again.');
            const db = readDb();
            const user = owner(db, userId);
            const connections = user.connections ||= [];
            const previous = connections.find(item => item.platform === input.platform && item.accountId === verified.accountId);
            const now = new Date().toISOString();
            const connection = { id: previous?.id || crypto.randomUUID(), platform: input.platform, ...verified, status: 'verified', createdAt: previous?.createdAt || now, verifiedAt: now, checkedAt: now };
            connection.secret = encrypt(input.token, userId, connection);
            if (previous) connections.splice(connections.indexOf(previous), 1, connection);
            else connections.push(connection);
            writeDb(db);
            return safe(connection);
        });
    }
    async function check(userId, id, authorized = () => true) {
        return locked(userId, async () => {
            const connection = (owner(readDb(), userId).connections || []).find(item => item.id === id);
            if (!connection) throw error(404, 'Connection not found.');
            const token = decrypt(userId, connection);
            let verified, failure;
            try { verified = await verify(connection.platform, connection.pageId || connection.accountId, token); }
            catch (cause) { failure = cause; }
            if (!authorized()) throw error(401, 'Your session ended. Sign in and try again.');
            const db = readDb();
            const current = owner(db, userId).connections.find(item => item.id === id);
            current.checkedAt = new Date().toISOString();
            if (verified && verified.accountId !== connection.accountId) failure = error(422, 'The linked account has changed. Remove this connection and connect again.');
            current.status = failure ? 'needs_attention' : 'verified';
            if (!failure) { current.verifiedAt = current.checkedAt; current.label = verified.label; }
            writeDb(db);
            if (failure) throw failure;
            return safe(current);
        });
    }
    async function remove(userId, id) {
        return locked(userId, async () => {
            const db = readDb();
            const user = owner(db, userId);
            const index = (user.connections || []).findIndex(item => item.id === id);
            if (index === -1) throw error(404, 'Connection not found.');
            user.connections.splice(index, 1);
            writeDb(db);
        });
    }
    return { list, save, check, remove };
}

module.exports = { createConnections };
