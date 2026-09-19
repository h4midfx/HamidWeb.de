const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const E=require('../SignalEngine');
const Scanner=require('../SignalScanner');
function fixture(symbol,interval,now) {
    const step=interval==='15m'?900000:14400000,end=Math.floor(now/step)*step;
    const candles=Array.from({length:120},(_,i)=>({time:end-(120-i)*step,open:100+i*.1,close:100.05+i*.1,high:100.3+i*.1,low:99.8+i*.1}));
    Object.assign(candles[119],{open:111.8,close:112.5,high:112.6,low:111.6});
    return {symbol,interval,candles,price:112.5,spread:.0001,timestamp:now};
}
test('scanner checks both timeframes, limits concurrency, and never keeps expired or failed matches',async()=>{
    let clock=Date.now(),inflight=0,peak=0,calls=0,fail=false;
    const market={symbols:['BTCUSDT','ETHUSDT'],load:async(symbol,interval)=>{
        calls++;peak=Math.max(peak,++inflight);await new Promise(resolve=>setImmediate(resolve));inflight--;
        if(fail||symbol==='ETHUSDT')throw Error('offline');return fixture(symbol,interval,clock);
    }};
    const scanner=Scanner.create({market,engine:{...E,evaluate:()=>({eligible:true,stats:{winRate:.6,wins:12,closed:20}})},now:()=>clock});
    const work=scanner.run();assert.equal(scanner.run(),work);await work;
    assert.equal(calls,4);assert.equal(peak,2);assert.equal(scanner.snapshot().filter(r=>r.active).length,10);
    assert.equal(scanner.snapshot().filter(r=>r.state==='error').length,10);
    clock+=61000;assert.equal(scanner.snapshot().filter(r=>r.active).length,0);
    fail=true;await scanner.run();assert.ok(scanner.snapshot().every(r=>r.state==='error'&&!r.active));
});
test('scanner keeps the same quality gate as the detail page and pauses hidden-page work',async()=>{
    let visible=false,calls=0;
    const market={symbols:['BTCUSDT'],load:async(symbol,interval)=>{calls++;return fixture(symbol,interval,Date.now());}};
    const scanner=Scanner.create({market,engine:E,isVisible:()=>visible});
    await scanner.run();assert.equal(calls,0);
    visible=true;await scanner.run();assert.equal(calls,2);assert.ok(scanner.snapshot().every(r=>!r.active));
});
test('mounted Persian overview starts without a click and renders actual qualifying symbols',async()=>{
    const nodes=new Map();const get=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:''});return nodes.get(selector);};
    const host={innerHTML:'',querySelector:get};let calls=0;const timers=[];
    const context=vm.createContext({module:{exports:{}},document:{hidden:false,addEventListener(){}},setTimeout:(fn,delay)=>{timers.push(delay);return 1;},clearTimeout(){},setInterval(){}});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../SignalScanner.js'),'utf8'),context);
    const market={symbols:['BTCUSDT'],load:async(symbol,interval)=>{calls++;return fixture(symbol,interval,Date.now());}};
    const scanner=context.module.exports.mount(host,market,{...E,evaluate:()=>({eligible:true,stats:{winRate:.6,wins:12,closed:20}})});
    await scanner.run();assert.equal(calls,2);assert.equal(host.lang,'fa');assert.equal(host.dir,'rtl');
    assert.match(get('.rr-results').innerHTML,/BTC \/ USDT/);assert.match(get('.rr-results').innerHTML,/symbol=BTCUSDT&amp;|symbol=BTCUSDT&/);
    assert.ok(timers.includes(30000));
    for(const rr of E.REWARDS) assert.ok(get('.rr-results').innerHTML.includes('&rr='+rr+'"'));
    assert.equal((get('.rr-results').innerHTML.match(/class="rr-match"/g)||[]).length,10);
    assert.match(get('.rr-results').innerHTML,/۶۰٪/);
    assert.match(get('.rr-results').innerHTML,/۱۲ برد از ۲۰/);
});
test('Persian dashboard lists programs and loads trading tools only on the Signals page',()=>{
    const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
    assert.match(html,/<html lang="fa" dir="rtl">/);
    assert.doesNotMatch(html,/data-signal-scanner|data-random-positions|SignalScanner\.js|RandomPositions\.js|SignalMarket\.js|SignalEngine\.js/);
    for(const page of ['SocialPortal.html','HamidCalculator.html','CryptoSignals.html'])assert.ok(html.includes("location.href='"+page+"'"));
    const signals=fs.readFileSync(path.join(__dirname,'../CryptoSignals.html'),'utf8');
    assert.match(signals,/<html lang="fa" dir="rtl">/);
    assert.match(signals,/data-signal-scanner/);assert.match(signals,/data-random-positions/);
    assert.match(signals,/SignalScanner.js.*defer/);assert.match(signals,/RandomPositions.js.*defer/);
});

test('scanner keeps target-specific eligibility while fetching each market only once',async()=>{
    let calls=0,evaluations=0;
    const market={symbols:['BTCUSDT'],load:async(symbol,interval)=>{calls++;return fixture(symbol,interval,Date.now());}};
    const engine={...E,evaluate:(candles,rr)=>{evaluations++;return {eligible:rr===3,stats:{winRate:rr===3?.65:.4,wins:rr===3?13:8,closed:20}};}};
    const scanner=Scanner.create({market,engine});await scanner.run();
    assert.equal(calls,2);assert.equal(evaluations,10);assert.equal(scanner.snapshot().length,10);
    const active=scanner.snapshot().filter(row=>row.active);assert.equal(active.length,2);
    assert.ok(active.every(row=>row.rr===3&&row.setup.rr===3));
    await scanner.run();assert.equal(calls,4);assert.equal(evaluations,10);
});
test('diagnostics distinguish insufficient samples, low win rates, and actual entry signals',()=>{
    const report=(closed,winRate,returnPct,eligible)=>({eligible,stats:{closed,winRate,returnPct}});
    const rows=[{report:report(5,.8,20,false),active:false},{report:report(25,.4,15,false),active:false},{report:report(25,.64,10,true),active:false},{report:report(30,.7,11,true),active:true},{state:'error',active:false}];
    const result=Scanner.diagnose(rows);
    assert.equal(result.tested,4);assert.equal(result.insufficient,1);assert.equal(result.belowWinRate,1);
    assert.equal(result.historicalPass,2);assert.equal(result.active,1);
    assert.ok(result.best.every(row=>row.report.stats.closed>=20));
});
