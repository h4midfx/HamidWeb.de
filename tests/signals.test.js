const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('../SignalEngine');
function bars() {
    const rows = Array.from({ length: 60 }, (_, i) => ({ time: i * 900000, open: 100 + i * .1, close: 100.05 + i * .1, high: 100.3 + i * .1, low: 99.8 + i * .1 }));
    rows[59] = { time: 59 * 900000, open: 105.8, close: 106.5, high: 106.6, low: 105.6 };
    return rows;
}
test('closed candles are chronological, deduplicated and validated', () => {
    const rows = bars();
    const open = { ...rows.at(-1), time: 60 * 900000 };
    assert.deepEqual(E.normalize([open, ...rows.slice().reverse(), rows[0]], '15m', 60 * 900000 + 1), rows);
    assert.throws(() => E.normalize(rows, '15m', 64 * 900000), /قدیمی/);
    assert.throws(() => E.normalize([...rows, { ...open, close: NaN }], '15m', 61 * 900000), /نامعتبر/);
});
test('long and short targets are exactly ten times structural risk', () => {
    for (const rows of [bars(), bars().map(c => ({ ...c, open: 210 - c.open, close: 210 - c.close, high: 210 - c.low, low: 210 - c.high }))]) {
        const s = E.signal(rows);
        assert.ok(s.side);
        assert.ok(Math.abs(Math.abs(s.target - s.entry) / Math.abs(s.entry - s.stop) - 10) < 1e-10);
        assert.ok(s.side * (s.entry - s.stop) > 0);
    }
});
test('insufficient history and chasing price cannot generate entries', () => {
    assert.equal(E.signal([]).side, undefined);
    assert.equal(E.signal(bars(), 120).side, undefined);
});
test('ambiguous candles stop out and gaps use the worse opening price', () => {
    const long = { side: 1, stop: 99, target: 110 };
    assert.equal(E.exitPrice(long, { open: 100, low: 98, high: 111 }), 99);
    assert.equal(E.exitPrice(long, { open: 95, low: 94, high: 111 }), 95);
    assert.equal(E.exitPrice({ side: -1, stop: 101, target: 90 }, { open: 100, low: 89, high: 102 }), 101);
});
test('backtest uses next open, costs, and stop-first execution', () => {
    const rows = [...bars(), { time: 60 * 900000, open: 106.5, high: 130, low: 100, close: 107 }];
    const r = E.backtest(rows);
    assert.equal(r.trades.length, 1);
    assert.ok(Math.abs(r.equity - 99) < 1e-8);
    assert.ok(Math.abs(r.maxDrawdown - .01) < 1e-8);
    const last = { ...rows.at(-1), open: 120 };
    assert.equal(E.backtest([...bars(), last]).trades.length, 0);
});
test('rejects conflicting duplicate candles and misaligned time', () => {
    assert.throws(()=>E.normalize([...bars(),{...bars()[0],close:100.1}],'15m',60*900000),/ناسازگار/);
    assert.throws(()=>E.normalize(bars().map(c=>({...c,time:c.time+1})),'15m',60*900000),/زمان کندل/);
});
test('historical gate blocks small samples and distinguishes forced closes',()=>{
    const report=E.evaluate(bars());
    assert.equal(report.eligible,false);
    assert.equal(report.stats.profitFactor,null);
    assert.equal(report.stats.winRate,null);
    const stats=E.summarize({trades:[{result:2,forced:true},{result:-1,forced:false}],equity:101,maxDrawdown:.01});
    assert.equal(stats.closed,1);assert.equal(stats.forced,1);assert.equal(stats.profitFactor,2);
});
test('60 percent filter includes the boundary and rejects lower or missing rates',()=>{
    const stats={closed:20,winRate:.6,returnPct:5,profitFactor:1.5};
    assert.equal(E.historicalEligibility(stats).eligible,true);
    for(const winRate of [.5999,.55,null,NaN]) assert.equal(E.historicalEligibility({...stats,winRate}).eligible,false);
    assert.equal(E.historicalEligibility({...stats,closed:19}).eligible,false);
    assert.equal(E.historicalEligibility({...stats,returnPct:-1}).eligible,false);
    assert.equal(E.historicalEligibility({...stats,profitFactor:1.1}).eligible,false);
});
test('forced end-of-sample profits cannot inflate the measured win rate',()=>{
    const trades=Array.from({length:20},(_,i)=>({result:i<11?1:-1,forced:false}));
    trades.push({result:500,forced:true});
    const stats=E.summarize({trades,equity:500,maxDrawdown:0});
    assert.equal(stats.winRate,.55);assert.equal(stats.closed,20);assert.equal(stats.wins,11);
    assert.equal(E.historicalEligibility(stats).eligible,false);
});
test('a winning sample with no losses is eligible without inventing a finite profit factor',()=>{
    const stats=E.summarize({trades:Array.from({length:20},()=>({result:1,forced:false})),equity:120,maxDrawdown:0});
    assert.equal(stats.winRate,1);assert.equal(stats.profitFactor,Infinity);assert.equal(E.historicalEligibility(stats).eligible,true);
});
test('every supported target has the exact reward ratio for long and short entries',()=>{
    for(const rr of E.REWARDS) for(const candles of [bars(),bars().map(c=>({...c,open:210-c.open,close:210-c.close,high:210-c.low,low:210-c.high}))]) {
        const setup=E.signal(candles,undefined,rr);
        assert.ok(setup.side);assert.equal(setup.rr,rr);
        assert.ok(Math.abs(Math.abs(setup.target-setup.entry)/Math.abs(setup.entry-setup.stop)-rr)<1e-9);
    }
    assert.throws(()=>E.signal(bars(),undefined,0));assert.throws(()=>E.backtest([],6));
});
test('each target is independently backtested rather than inheriting 10R results',()=>{
    const seven=E.signal(bars(),undefined,7);
    const candles=[...bars(),{time:60*900000,open:106.5,high:seven.target+.01,low:106.4,close:106.6}];
    for(const rr of E.REWARDS) {
        const result=E.backtest(candles,rr);assert.equal(result.trades.length,1);
        if(rr<=7){assert.equal(result.trades[0].forced,false);assert.ok(Math.abs(result.trades[0].exit-E.signal(bars(),undefined,rr).target)<1e-9);}
        else assert.equal(result.trades[0].forced,true);
        assert.equal(E.evaluate(candles,rr).rr,rr);
    }
});
test('qualification reports historical and structural blockers together',()=>{
    const data={candles:bars(),price:120,interval:'15m',timestamp:60*900000,spread:.0001};
    const report={rr:3,eligible:false,reason:'historical threshold failed'};
    const assessment=E.qualify(data,report,60*900000+1000);
    assert.equal(assessment.active,false);assert.ok(assessment.blockers.includes(report.reason));
    assert.ok(assessment.blockers.includes(assessment.setup.reason));
});
