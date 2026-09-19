(function(root) {
    'use strict';
    const symbols = ['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','BNBUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT','LINKUSDT','TONUSDT','SUIUSDT','LTCUSDT'];
    const HISTORY_LIMIT = 10000;
    const historyCache = new Map();
    function validate(payload, symbol, now) {
        if (payload?.retCode !== 0 || payload.result?.category !== 'linear' || !Array.isArray(payload.result.list) || !payload.result.list.length) throw Error('داده معتبر از صرافی دریافت نشد.');
        if (!Number.isFinite(payload.time) || Math.abs(now - payload.time) > 60000) throw Error('پاسخ صرافی قدیمی است یا ساعت دستگاه نادرست است.');
        if (payload.result.symbol && payload.result.symbol !== symbol) throw Error('بازار پاسخ با بازار انتخاب‌شده یکسان نیست.');
        return payload.result.list;
    }
    async function load(symbol, interval, fetcher = fetch, now = () => Date.now(), useCache = false, historyLimit = HISTORY_LIMIT) {
        if (!Number.isInteger(historyLimit) || historyLimit < 1000 || historyLimit > HISTORY_LIMIT || historyLimit % 1000 !== 0) throw Error("Invalid history limit");
        if (!symbols.includes(symbol) || !['15m','4h'].includes(interval)) throw Error('بازار یا بازه زمانی نامعتبر است.');
        async function request(path) {
            const response = await fetcher('https://api.bybit.com/v5/market/' + path, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw Error('بای‌بیت در دسترس نیست (HTTP ' + response.status + '). داده جایگزین استفاده نمی‌شود.');
            const payload = await response.json();
            validate(payload, symbol, now());
            return payload;
        }
        const duration = interval === '15m' ? 900000 : 14400000;
        const cacheKey = symbol + ':' + interval + ':' + historyLimit, bucket = Math.floor(now()/duration);
        const saved = useCache ? historyCache.get(cacheKey) : null;
        const cached = saved && saved.bucket === bucket;
        const candles = cached ? saved.candles.slice() : []; let end = now();
        for (let page = 0; !cached && page < historyLimit / 1000; page++) {
            const payload = await request(`kline?category=linear&symbol=${symbol}&interval=${interval === '15m' ? '15' : '240'}&limit=1000&end=${end}`);
            if (payload.result.symbol !== symbol) throw Error('بازار کندل مشخص نیست یا تطابق ندارد.');
            const rows = payload.result.list;
            const batch = rows.map(r => ({ time: Number(r[0]), open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]), volume: Number(r[5]) }));
            if (batch.some(c => !Number.isFinite(c.volume) || c.volume < 0 || !Number.isSafeInteger(c.time))) throw Error('داده کندل نامعتبر است.');
            const earliest = Math.min(...batch.map(c => c.time));
            if (earliest > end) throw Error('ترتیب صفحات داده نامعتبر است.');
            candles.push(...batch); end = earliest - 1;
            if (rows.length < 1000) break;
        }
        const ticker = await request(`tickers?category=linear&symbol=${symbol}`);
        const quote = ticker.result.list.find(t => t.symbol === symbol);
        const price = Number(quote?.lastPrice), bid = Number(quote?.bid1Price), ask = Number(quote?.ask1Price);
        if (![price,bid,ask].every(v => Number.isFinite(v) && v > 0) || ask < bid) throw Error('قیمت صرافی نامعتبر است.');
        if (useCache && Math.floor(ticker.time/duration) === bucket) historyCache.set(cacheKey, { bucket, candles: candles.filter(c=>c.time+duration<=ticker.time) });
        return { candles, price, bid, ask, spread: (ask - bid) / price, timestamp: ticker.time, receivedAt: now(), source: 'بای‌بیت · قرارداد دائمی تتر', symbol, interval };
    }
    const api = { load, validate, symbols, HISTORY_LIMIT };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SignalMarket = api;
})(globalThis);
