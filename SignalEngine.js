(function (root) {
    'use strict';
    const REWARDS = Object.freeze([3, 4, 5, 7, 10]);
    const RR = 10, FEE = 0.001, SLIPPAGE = 0.0005;
    function normalize(candles, interval, now = Date.now()) {
        const duration = { '15m': 900000, '4h': 14400000 }[interval];
        if (!duration) throw new Error('بازه زمانی پشتیبانی نمی‌شود');
        const seen = new Map();
        for (const c of candles) {
            if (!Number.isSafeInteger(c.time) || c.time < 0 || c.time % duration !== 0) throw Error('زمان کندل نامعتبر است');
            const prior = seen.get(c.time);
            if (prior && ['open','high','low','close'].some(k => prior[k] !== c[k])) throw Error('کندل‌های تکراری ناسازگار هستند');
            seen.set(c.time, c);
        }
        const sorted = [...new Map(candles.map(c => [c.time, c])).values()]
            .sort((a, b) => a.time - b.time);
        if (sorted.some(c => ![c.time, c.open, c.high, c.low, c.close].every(Number.isFinite) ||
            Math.min(c.open, c.high, c.low, c.close) <= 0 || c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close))) {
            throw new Error('کندل بازار نامعتبر است');
        }
        const closed = sorted.filter(c => c.time + duration <= now);
        if (closed.length < 60) throw new Error('حداقل ۶۰ کندل بسته لازم است');
        if (now - (closed.at(-1).time + duration) > duration) throw new Error('داده بازار قدیمی است');
        if (closed.some((c, i) => i && c.time - closed[i - 1].time !== duration)) throw new Error('در داده‌های بازار کندل مفقود وجود دارد');
        return closed;
    }
    function signal(candles, entry = candles.at(-1)?.close, rr = RR) {
        if (!REWARDS.includes(rr)) throw Error('نسبت هدف پشتیبانی نمی‌شود');
        const wait = reason => ({ direction: 'WAIT', entry: null, stop: null, target: null, reason, rr });
        if (candles.length < 60) return wait('حداقل ۶۰ کندل بسته لازم است.');
        const current = candles.at(-1), previous = candles.slice(-21, -1);
        const high = Math.max(...previous.map(c => c.high)), low = Math.min(...previous.map(c => c.low));
        const closes = candles.slice(-60).map(c => c.close);
        let fast = closes[0], slow = closes[0];
        for (const close of closes.slice(1)) { fast += (close - fast) * 2 / 21; slow += (close - slow) * 2 / 51; }
        const ranges = candles.slice(-15);
        const atr = ranges.slice(1).reduce((sum, c, i) => sum + Math.max(c.high - c.low, Math.abs(c.high - ranges[i].close), Math.abs(c.low - ranges[i].close)), 0) / 14;
        const bull = current.close > high || (current.low < low && current.close > low && current.close > current.open);
        const bear = current.close < low || (current.high > high && current.close < high && current.close < current.open);
        if (bull === bear || atr <= 0 || Math.abs(current.close - current.open) < atr * 0.5) return wait('ساختار روشن و کندل تأییدکننده وجود ندارد.');
        const side = bull ? 1 : -1;
        if (side * (fast - slow) <= 0 || side * (current.close - fast) <= 0) return wait('روند و ساختار بازار هم‌جهت نیستند.');
        if (!Number.isFinite(entry) || entry <= 0 || Math.abs(entry - current.close) > atr * 0.25) return wait('قیمت از نقطه ورود فاصله گرفته؛ منتظر کندل بعدی بمانید.');
        const swing = candles.slice(-6);
        const stop = side === 1 ? Math.min(...swing.map(c => c.low)) - atr * 0.25 : Math.max(...swing.map(c => c.high)) + atr * 0.25;
        const risk = side * (entry - stop), target = entry + side * rr * risk;
        if (risk < atr || risk / entry > 0.05 || risk / entry < 2 * (FEE + SLIPPAGE) || target <= 0 || stop <= 0) return wait('فاصله حد ضرر با نوسان و هزینه‌ها سازگار نیست.');
        return { direction: side === 1 ? 'LONG' : 'SHORT', side, entry, stop, target, rr, reason: `${current.close > high || current.close < low ? 'شکست ساختار' : 'جمع‌آوری نقدینگی'} + EMA20/50`, time: current.time };
    }
    function exitPrice(position, candle) {
        const { side, stop, target } = position;
        if (side * (candle.open - stop) <= 0) return candle.open;
        // When both levels occur in one bar, assume the stop was reached first.
        if (side === 1 ? candle.low <= stop : candle.high >= stop) return stop;
        if (side === 1 ? candle.high >= target : candle.low <= target) return target;
        return null;
    }
    function backtest(candles, rr = RR) {
        if (!REWARDS.includes(rr)) throw Error('نسبت هدف پشتیبانی نمی‌شود');
        let position = null, equity = 100, peak = 100, maxDrawdown = 0;
        const trades = [];
        const pnl = (p, price) => p.units * (p.side * (price * (1 - p.side * SLIPPAGE) - p.fill) - FEE * (p.fill + price * (1 - p.side * SLIPPAGE)));
        for (let i = 60; i < candles.length; i++) {
            const candle = candles[i];
            if (!position && equity > 0) {
                const setup = signal(candles.slice(i - 60, i), candle.open, rr);
                if (setup.side) {
                    const fill = setup.entry * (1 + setup.side * SLIPPAGE);
                    const stopFill = setup.stop * (1 - setup.side * SLIPPAGE);
                    const loss = setup.side * (fill - stopFill) + FEE * (fill + stopFill);
                    position = { ...setup, fill, units: Math.min(equity * 0.01 / loss, equity / fill) };
                }
            }
            if (position) {
                const price = exitPrice(position, candle);
                if (price !== null || i === candles.length - 1) {
                    const result = pnl(position, price ?? candle.close);
                    equity += result;
                    trades.push({ result, exit: price ?? candle.close, forced: price === null, entryTime: position.time, exitTime: candle.time });
                    position = null;
                }
            }
            const marked = equity + (position ? pnl(position, candle.close) : 0);
            peak = Math.max(peak, marked);
            maxDrawdown = Math.max(maxDrawdown, (peak - marked) / peak);
        }
        return { trades, equity, maxDrawdown };
    }
    function summarize(result) {
        const completed = result.trades.filter(t => !t.forced);
        const wins = completed.filter(t => t.result > 0).length;
        const gains = result.trades.reduce((sum,t) => sum + Math.max(t.result,0),0);
        const losses = result.trades.reduce((sum,t) => sum + Math.max(-t.result,0),0);
        return { count: result.trades.length, closed: completed.length, wins, forced: result.trades.filter(t => t.forced).length,
            winRate: completed.length ? wins / completed.length : null,
            profitFactor: losses > 0 ? gains / losses : gains > 0 ? Infinity : null, returnPct: result.equity - 100, maxDrawdown: result.maxDrawdown };
    }
    function historicalEligibility(stats) {
        if (stats.closed < 20) return { eligible: false, reason: 'تعداد معاملات بسته‌شده کافی نیست؛ حداقل ۲۰ معامله لازم است.' };
        if (!Number.isFinite(stats.winRate) || stats.winRate < 0.6) return { eligible: false, reason: 'نرخ برد تاریخی کمتر از ۶۰٪ است یا قابل محاسبه نیست.' };
        if (!(stats.returnPct > 0) || !(stats.profitFactor >= 1.2)) return { eligible: false, reason: 'بازده مثبت و ضریب سود حداقل ۱٫۲ لازم است.' };
        return { eligible: true, reason: 'نرخ برد تاریخی حداقل ۶۰٪ و شرایط بررسی برقرار است؛ احتمال برد معامله بعدی مشخص نیست.' };
    }
    function evaluate(candles, rr = RR) {
        const split = Math.max(60, Math.floor(candles.length * 0.7));
        const full = backtest(candles, rr), recent = backtest(candles.slice(Math.max(0,split - 60)), rr);
        const stats = summarize(recent);
        const { eligible, reason } = historicalEligibility(stats);
        return { rr, full, recent, stats, eligible, reason, start: candles[split]?.time, end: candles.at(-1)?.time };
    }
    function qualify(data, report, now = Date.now()) {
        const setup = signal(data.candles, data.price, report.rr ?? RR);
        const duration = { '15m': 900000, '4h': 14400000 }[data.interval];
        const expiresAt = Math.min(data.timestamp + 60000, data.candles.at(-1).time + duration * 2);
        const fresh = Number.isFinite(expiresAt) && now < expiresAt && data.timestamp <= now + 5000;
        const spreadOK = Number.isFinite(data.spread) && data.spread >= 0 && data.spread <= .001;
        const active = Boolean(setup.side && report.eligible && fresh && spreadOK);
        const blockers = [];
        if (!report.eligible) blockers.push(report.reason || 'شرایط بک‌تست برقرار نیست.');
        if (!setup.side) blockers.push(setup.reason);
        if (!fresh) blockers.push('قیمت منقضی شده؛ منتظر دریافت تازه بمانید.');
        if (!spreadOK) blockers.push('اختلاف خرید و فروش از حد مجاز بیشتر است.');
        return { setup, active, fresh, spreadOK, expiresAt, blockers };
    }
    const api = { RR, REWARDS, FEE, SLIPPAGE, normalize, signal, exitPrice, backtest, summarize, historicalEligibility, evaluate, qualify };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SignalEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
