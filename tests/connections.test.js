const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createConnections } = require('../SocialConnections');

function fixture(t) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-connections-'));
    const dbFile = path.join(dataDir, 'portal.json');
    fs.writeFileSync(dbFile, JSON.stringify({ users: [{ id: 'alice' }, { id: 'bob' }] }));
    const readDb = () => JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    const writeDb = db => fs.writeFileSync(dbFile, JSON.stringify(db));
    t.after(() => {
        for (const file of ['portal.json', 'connections.key']) {
            const target = path.join(dataDir, file);
            if (fs.existsSync(target)) fs.unlinkSync(target);
        }
        fs.rmdirSync(dataDir);
    });
    return { dataDir, dbFile, readDb, writeDb, encryptionKey: '', graphVersion: 'v26.0' };
}
const telegramToken = '123456789:synthetic_test_token_abcdefghijklmnop';
const pageToken = 'synthetic_meta_page_token_for_tests_only';
const ok = body => ({ ok: true, json: async () => body });

test('tokens are verified, encrypted, kept private, reused after restart, and removable only by their owner', async t => {
    const f = fixture(t);
    let rejected = false;
    const calls = [];
    const fetchImpl = async (url, options) => {
        calls.push({ url, options });
        assert.equal(options.redirect, 'error');
        if (rejected) return { ok: false, json: async () => ({ description: `Do not echo ${telegramToken}` }) };
        if (url.endsWith('/getMe')) return ok({ ok: true, result: { id: 123456789, is_bot: true } });
        if (url.endsWith('/getChat')) return ok({ ok: true, result: { id: -10012345678, type: 'channel', title: 'My channel' } });
        if (url.endsWith('/getChatMember')) return ok({ ok: true, result: { status: 'administrator' } });
        throw Error('Unexpected test URL');
    };
    let service = createConnections({ ...f, fetchImpl });
    const connection = await service.save('alice', { platform: 'telegram', accountId: '@my_channel', token: telegramToken });
    assert.equal(connection.status, 'verified');
    assert.equal(connection.accountId, '-10012345678');
    assert.ok(!JSON.stringify(connection).includes(telegramToken));
    assert.ok(!Object.hasOwn(connection, 'secret'));
    assert.ok(!fs.readFileSync(f.dbFile, 'utf8').includes(telegramToken));
    assert.equal(fs.readFileSync(path.join(f.dataDir, 'connections.key')).length, 32);
    assert.deepEqual(service.list('bob'), []);
    const before = calls.length;
    await assert.rejects(service.check('bob', connection.id), { status: 404 });
    await assert.rejects(service.remove('bob', connection.id), { status: 404 });
    assert.equal(calls.length, before);
    service = createConnections({ ...f, fetchImpl });
    await service.check('alice', connection.id);
    assert.ok(calls.slice(before).every(call => call.url.includes(telegramToken)));
    assert.equal(calls.at(-1).options.method, 'POST');
    rejected = true;
    await assert.rejects(service.check('alice', connection.id), cause => cause.status === 422 && !cause.message.includes(telegramToken));
    assert.equal(service.list('alice')[0].status, 'needs_attention');
    rejected = false;
    await service.check('alice', connection.id);
    assert.equal(service.list('alice')[0].status, 'verified');
    await service.remove('alice', connection.id);
    assert.deepEqual(service.list('alice'), []);
    assert.ok(!fs.readFileSync(f.dbFile, 'utf8').includes('secret'));
});

test('Meta checks the token identity, resolves linked Instagram and never saves rejected credentials', async t => {
    const f = fixture(t);
    let pageId = '12345678';
    const service = createConnections({ ...f, fetchImpl: async (url, options) => {
        assert.ok(url.startsWith('https://graph.facebook.com/v26.0/me?'));
        assert.ok(!url.includes(pageToken));
        assert.equal(options.headers.Authorization, `Bearer ${pageToken}`);
        return ok({ id: pageId, name: 'My Page', category: 'Creator', instagram_business_account: { id: '987654321', username: 'my_instagram' } });
    } });
    const fb = await service.save('alice', { platform: 'facebook', accountId: '12345678', token: pageToken });
    const ig = await service.save('alice', { platform: 'instagram', accountId: '12345678', token: pageToken });
    assert.equal(ig.accountId, '987654321');
    assert.equal(service.list('alice').length, 2);
    await service.check('alice', ig.id);
    pageId = '11111111';
    await assert.rejects(service.save('bob', { platform: 'facebook', accountId: '12345678', token: pageToken }), { status: 422 });
    assert.deepEqual(service.list('bob'), []);
    pageId = '12345678';
    const replaced = await service.save('alice', { platform: 'facebook', accountId: '12345678', token: pageToken });
    assert.equal(replaced.id, fb.id);
    assert.equal(service.list('alice').length, 2);
    assert.ok(!fs.readFileSync(f.dbFile, 'utf8').includes(pageToken));
    await assert.rejects(service.save('bob', { platform: 'facebook', accountId: '12345678', token: pageToken }, () => false), { status: 401 });
    assert.deepEqual(service.list('bob'), []);
    const db = f.readDb();
    db.users[1].connections = [structuredClone(db.users[0].connections[0])];
    f.writeDb(db);
    await assert.rejects(service.check('bob', fb.id), { status: 503 });
});

test('invalid targets, unsupported platforms, and non-admin Telegram bots cannot be saved', async t => {
    const f = fixture(t);
    let calls = 0;
    const service = createConnections({ ...f, fetchImpl: async url => {
        calls++;
        if (url.endsWith('/getMe')) return ok({ ok: true, result: { id: 123456789, is_bot: true } });
        if (url.endsWith('/getChat')) return ok({ ok: true, result: { id: -10012345678, type: 'channel' } });
        return ok({ ok: true, result: { status: 'member' } });
    } });
    await assert.rejects(service.save('alice', { platform: 'whatsapp', accountId: '12345678', token: pageToken }), { status: 400 });
    await assert.rejects(service.save('alice', { platform: 'facebook', accountId: 'https://evil.example', token: pageToken }), { status: 400 });
    await assert.rejects(service.save('alice', { platform: 'telegram', accountId: '@my_channel', token: 'password' }), { status: 400 });
    assert.equal(calls, 0);
    await assert.rejects(service.save('alice', { platform: 'telegram', accountId: '@my_channel', token: telegramToken }), { status: 422 });
    assert.deepEqual(service.list('alice'), []);
    assert.ok(!fs.existsSync(path.join(f.dataDir, 'connections.key')));
});
