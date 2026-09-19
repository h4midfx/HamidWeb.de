'use strict';
const form = document.getElementById('accountsForm');
const saveStatus = document.getElementById('saveStatus');
const authForm = document.getElementById('authForm');
const authStatus = document.getElementById('authStatus');
const draft = document.getElementById('draft');
const fields = ['telegram', 'facebook', 'instagram', 'whatsapp', 'whatsappType', 'other', 'useFacebook', 'useInstagram', 'useWhatsapp'];
let session = null;
let viewVersion = 0;
const connectionForm = document.getElementById('connectionForm');
const connectionStatus = document.getElementById('connectionStatus');
let connectionList = [];
let connectionBusy = false;

document.getElementById('connectionGuide').addEventListener('click', () => document.getElementById('connectionDialog').showModal());
const saveDraftButton = document.createElement('button');
saveDraftButton.type = 'button';
saveDraftButton.className = 'button secondary';
saveDraftButton.id = 'saveDraftButton';
saveDraftButton.textContent = 'ذخیرهٔ پیش‌نویس';
saveDraftButton.disabled = true;
document.querySelector('.draft-bottom').append(saveDraftButton);
const draftStatus = document.createElement('p');
draftStatus.id = 'draftStatus';
draftStatus.setAttribute('role', 'status');
document.querySelector('.draft-bottom').after(draftStatus);

async function api(route, method = 'GET', body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (session?.csrf) headers['X-CSRF-Token'] = session.csrf;
    let response;
    try {
        response = await fetch(`/api/portal/${route}`, {
            method, headers, credentials: 'same-origin', cache: 'no-store',
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            signal: AbortSignal.timeout(route.startsWith('connections') ? 35000 : 12000)
        });
    } catch { throw Error('ارتباط با سرور برقرار نشد. دوباره تلاش کن.'); }
    let data;
    try { data = await response.json(); } catch { throw Error('این صفحه را از سرور سایت باز کن، نه با باز کردن مستقیم فایل.'); }
    if (!response.ok) {
        if ([401, 403].includes(response.status) && !['login', 'register'].includes(route)) {
            renderSession(null);
            authStatus.textContent = 'نشست تغییر کرده یا پایان یافته است. دوباره وارد شو.';
        }
        throw Error(data.error || 'درخواست انجام نشد.');
    }
    return data;
}
function countDraft() {
    document.getElementById('charCount').textContent = `${Array.from(draft.value).length.toLocaleString('fa')} نویسه`;
}
function renderSession(value) {
    viewVersion++;
    session = value?.authenticated ? value : null;
    connectionForm.reset();
    updateConnectionHelp();
    connectionList = [];
    connectionStatus.textContent = '';
    document.getElementById('connectionFields').disabled = true;
    renderConnections();
    form.reset();
    draft.value = '';
    countDraft();
    saveStatus.textContent = '';
    draftStatus.textContent = '';
    document.getElementById('preview').hidden = true;
    document.getElementById('previewText').textContent = '';
    document.getElementById('settingsFields').disabled = true;
    saveDraftButton.disabled = true;
    authForm.hidden = !!session;
    document.getElementById('signedIn').hidden = !session;
    document.getElementById('accountName').textContent = session?.username || '';
    document.getElementById('historyStatus').textContent = session ? 'در حال بارگذاری…' : 'برای دیدن تاریخچه، وارد حساب پورتال شو.';
    document.getElementById('settingsHint').textContent = session ? 'در حال بارگذاری تنظیمات حساب…' : 'برای ذخیرهٔ تنظیمات وارد حساب پورتال شو.';
}
async function loadAccount() {
    const version = viewVersion;
    const [settings, savedDraft, history, savedConnections] = await Promise.all([api('settings'), api('draft'), api('history'), api('connections')]);
    if (version !== viewVersion || !session) return;
    connectionList = savedConnections.connections;
    document.getElementById('connectionFields').disabled = connectionBusy;
    renderConnections();
    for (const name of fields) {
        const field = form.elements.namedItem(name);
        if (field.type === 'checkbox') field.checked = settings.settings[name] === true;
        else field.value = settings.settings[name] || (name === 'whatsappType' ? 'channel' : '');
    }
    draft.value = savedDraft.draft || '';
    countDraft();
    document.getElementById('settingsFields').disabled = false;
    saveDraftButton.disabled = false;
    document.getElementById('settingsHint').textContent = 'لینک‌ها و مقصدهای دلخواهت را ذخیره کن. توکن اتصال را در بخش بعدی وارد کن.';
    document.getElementById('historyStatus').textContent = history.posts.length ? `${history.posts.length.toLocaleString('fa')} پست ثبت شده` : 'هنوز پستی منتشر نشده است. نشر خودکار پس از راه‌اندازی اتصال‌ها فعال خواهد شد.';
}
authForm.addEventListener('submit', async event => {
    event.preventDefault();
    const route = event.submitter?.value === 'register' ? 'register' : 'login';
    const buttons = authForm.querySelectorAll('button');
    buttons.forEach(button => { button.disabled = true; });
    authStatus.textContent = 'در حال بررسی…';
    try {
        const result = await api(route, 'POST', {
            username: document.getElementById('portalUsername').value,
            password: document.getElementById('portalPassword').value
        });
        document.getElementById('portalPassword').value = '';
        renderSession(result);
        await loadAccount();
        authStatus.textContent = route === 'register' ? 'حساب پورتالت ساخته شد.' : 'با موفقیت وارد شدی.';
    } catch (error) { authStatus.textContent = error.message; }
    finally { buttons.forEach(button => { button.disabled = false; }); }
});
document.getElementById('logoutButton').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
        await api('logout', 'POST', {});
        renderSession(null);
        authForm.reset();
        authStatus.textContent = 'از حساب خارج شدی.';
    } catch (error) { authStatus.textContent = error.message; }
    finally { button.disabled = false; }
});
form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!session) return;
    const version = viewVersion;
    const settings = {};
    for (const name of fields) {
        const field = form.elements.namedItem(name);
        settings[name] = field.type === 'checkbox' ? field.checked : field.value.trim();
    }
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    saveStatus.textContent = 'در حال ذخیره…';
    try {
        await api('settings', 'PUT', settings);
        if (version === viewVersion) saveStatus.textContent = 'تنظیمات در حساب خودت ذخیره شد. برای بررسی دسترسی، توکن را در بخش اتصال وارد کن.';
    } catch (error) { if (version === viewVersion) saveStatus.textContent = error.message; }
    finally { button.disabled = false; }
});
saveDraftButton.addEventListener('click', async () => {
    if (!session) return;
    const version = viewVersion;
    saveDraftButton.disabled = true;
    draftStatus.textContent = 'در حال ذخیره…';
    try {
        await api('draft', 'PUT', { draft: draft.value });
        if (version === viewVersion) draftStatus.textContent = 'پیش‌نویس ذخیره شد؛ چیزی منتشر نشد.';
    } catch (error) { if (version === viewVersion) draftStatus.textContent = error.message; }
    finally { saveDraftButton.disabled = !session; }
});
draft.addEventListener('input', () => {
    countDraft();
    draftStatus.textContent = '';
    document.getElementById('preview').hidden = true;
});
document.getElementById('previewButton').addEventListener('click', () => {
    const checks = document.getElementById('checks');
    checks.replaceChildren();
    const messages = [];
    if (!draft.value.trim()) messages.push('ابتدا متن آزمایشی را وارد کن.');
    if (!['useFacebook', 'useInstagram', 'useWhatsapp'].some(name => form.elements.namedItem(name).checked)) messages.push('در بخش حساب‌ها، مقصدهای مورد نظر را انتخاب کن.');
    if (form.elements.useFacebook.checked) messages.push('فیسبوک: تا اتصال صفحه و دریافت اجازهٔ نشر، ارسال انجام نمی‌شود.');
    if (form.elements.useInstagram.checked) messages.push('اینستاگرام: پست فقط متنی قابل نشر نیست؛ عکس یا ویدیوی سازگار و حساب حرفه‌ای لازم است.');
    if (form.elements.useWhatsapp.checked) messages.push('واتس‌اپ: نوع مقصد و پشتیبانی نشر باید بررسی شود.');
    messages.push('این فقط پیش‌نمایش است؛ هیچ پستی ارسال نشد.');
    for (const message of messages) { const item = document.createElement('li'); item.textContent = message; checks.append(item); }
    document.getElementById('previewText').textContent = draft.value;
    document.getElementById('preview').hidden = false;
});
function updateConnectionHelp() {
    const platform = document.getElementById('connectionPlatform').value;
    const telegram = platform === 'telegram';
    document.getElementById('connectionToken').value = '';
    document.getElementById('connectionTokenLabel').textContent = telegram ? 'توکن ربات تلگرام' : 'توکن دسترسی صفحه فیسبوک';
    document.getElementById('connectionAccountLabel').textContent = telegram ? 'نام کانال یا شناسهٔ کانال' : 'شناسهٔ عددی صفحهٔ فیسبوک';
    document.getElementById('connectionAccountId').placeholder = telegram ? '@your_channel / -100…' : 'شناسه صفحه فیسبوک';
    document.getElementById('connectionHelp').textContent = telegram
        ? 'توکن ربات خودت را از BotFather بگیر و ربات را مدیر کانالت بساز. این توکن رمز حساب تلگرام تو نیست.'
        : platform === 'instagram'
            ? 'توکن صفحهٔ فیسبوک متصل به حساب حرفه‌ای اینستاگرامت و شناسهٔ همان صفحه را وارد کن. توکن ورود اینستاگرام در این روش پشتیبانی نمی‌شود.'
            : 'Page access token و شناسهٔ همان صفحه را وارد کن. لینک، رمز حساب یا توکن حساب شخصی کافی نیست.';
    document.getElementById('connectionDocs').href = telegram ? 'https://core.telegram.org/bots/tutorial#obtain-your-bot-token' : 'https://www.postman.com/meta/facebook/documentation/r56bjfd/facebook-api';
}
document.getElementById('connectionPlatform').addEventListener('change', updateConnectionHelp);

function renderConnections() {
    const list = document.getElementById('connectionsList');
    list.replaceChildren();
    const verifiedCount = connectionList.filter(item => item.status === 'verified').length;
    document.getElementById('connectionCount').textContent = `${verifiedCount.toLocaleString('fa')} اتصال تأییدشده`;
    document.querySelectorAll('.account-grid .connection').forEach((badge, index) => {
        const platform = ['telegram', 'facebook', 'instagram', 'whatsapp'][index];
        const matches = connectionList.filter(item => item.platform === platform);
        badge.textContent = matches.some(item => item.status === 'verified') ? 'توکن بررسی شده' : matches.length ? 'نیاز به بررسی دوباره' : platform === 'whatsapp' ? 'نیازمند بررسی' : 'متصل نشده';
    });
    if (!connectionList.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = session ? 'هنوز اتصالی ذخیره نشده است.' : 'ابتدا وارد حساب پورتال شو.';
        list.append(empty);
    }
    for (const connection of connectionList) {
        const row = document.createElement('article');
        row.className = 'connection-row';
        const details = document.createElement('div');
        const title = document.createElement('strong');
        title.dir = 'auto';
        title.textContent = `${({telegram:'تلگرام',facebook:'فیسبوک',instagram:'اینستاگرام',whatsapp:'واتس‌اپ'})[connection.platform] || connection.platform} · ${connection.label}`;
        const meta = document.createElement('p');
        meta.className = 'muted';
        meta.textContent = `${connection.accountId} · ${connection.status === 'verified' ? 'توکن تأیید شده' : 'نیاز به بررسی'} · ${new Date(connection.checkedAt).toLocaleString('fa')}`;
        details.append(title, meta);
        const actions = document.createElement('div');
        actions.className = 'connection-actions';
        for (const [label, action] of [['بررسی دوباره', 'check'], ['حذف از پورتال', 'remove']]) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'button secondary';
            button.textContent = label;
            button.disabled = connectionBusy;
            button.addEventListener('click', () => connectionAction(connection.id, action));
            actions.append(button);
        }
        row.append(details, actions);
        list.append(row);
    }
}

async function refreshConnections(version) {
    const saved = await api('connections');
    if (version !== viewVersion || !session) return;
    connectionList = saved.connections;
    renderConnections();
}
async function connectionAction(id, action) {
    if (!session || connectionBusy) return;
    const version = viewVersion;
    connectionBusy = true;
    document.getElementById('connectionFields').disabled = true;
    renderConnections();
    connectionStatus.textContent = 'در حال بررسی…';
    try {
        await api(`connections/${id}${action === 'check' ? '/check' : ''}`, action === 'check' ? 'POST' : 'DELETE', action === 'check' ? {} : undefined);
        if (version === viewVersion) connectionStatus.textContent = action === 'check' ? 'سرور با توکن ذخیره‌شده اتصال را دوباره تأیید کرد.' : 'اطلاعات این اتصال از پورتال حذف شد.';
    } catch (failure) { if (version === viewVersion) connectionStatus.textContent = failure.message; }
    finally {
        if (version === viewVersion && session) {
            try { await refreshConnections(version); } catch (failure) { if (version === viewVersion) connectionStatus.textContent = failure.message; }
        }
        connectionBusy = false;
        document.getElementById('connectionFields').disabled = !session;
        renderConnections();
    }
}
connectionForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!session || connectionBusy) return;
    const version = viewVersion;
    const body = {
        platform: document.getElementById('connectionPlatform').value,
        accountId: document.getElementById('connectionAccountId').value.trim(),
        token: document.getElementById('connectionToken').value.trim()
    };
    // Clear the field before the network request; never cache it in browser storage.
    document.getElementById('connectionToken').value = '';
    connectionBusy = true;
    document.getElementById('connectionFields').disabled = true;
    renderConnections();
    connectionStatus.textContent = 'در حال بررسی توکن با شبکهٔ اجتماعی…';
    try {
        await api('connections', 'POST', body);
        if (version === viewVersion) {
            await refreshConnections(version);
            if (version === viewVersion) connectionStatus.textContent = 'اتصال بررسی و توکن به‌صورت رمزگذاری‌شده در حساب خودت ذخیره شد. چیزی منتشر نشد.';
        }
    } catch (failure) { if (version === viewVersion) connectionStatus.textContent = failure.message; }
    finally {
        body.token = '';
        connectionBusy = false;
        document.getElementById('connectionFields').disabled = !session;
        renderConnections();
    }
});

async function start() {
    if (!['http:', 'https:'].includes(location.protocol)) {
        document.getElementById('serverStatus').textContent = 'برای استفاده از حساب‌ها، npm.cmd start را اجرا کن و http://localhost:3000/SocialPortal.html را باز کن.';
        return;
    }
    try {
        const result = await api('session');
        renderSession(result);
        document.getElementById('serverStatus').textContent = 'سرور پورتال در دسترس است.';
        if (session) await loadAccount();
    } catch (error) { document.getElementById('serverStatus').textContent = error.message; }
}
start();
