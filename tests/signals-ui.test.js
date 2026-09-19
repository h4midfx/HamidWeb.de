const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const Engine=require('../SignalEngine');
const Market=require('../SignalMarket');
function page() {
    const nodes=new Map(), stored=new Map();let tick;
    const get=id=>{
        if(!nodes.has(id)) nodes.set(id,{value:id==='symbol'?'BTCUSDT':id==='interval'?'15m':'',textContent:'',innerHTML:'',className:'',dataset:{},handlers:{},addEventListener(event,fn){this.handlers[event]=fn;}});
        return nodes.get(id);
    };
    const context=vm.createContext({document:{getElementById:get},SignalEngine:Engine,SignalMarket:{...Market},localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,v)=>stored.set(key,v)},setInterval:fn=>{tick=fn;}});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../CryptoSignals.js'),'utf8'),context);
    const end=Math.floor(Date.now()/900000)*900000;
    const candles=Array.from({length:60},(_,i)=>({time:end-(60-i)*900000,open:100+i*.1,close:100.05+i*.1,high:100.3+i*.1,low:99.8+i*.1}));
    Object.assign(candles[59],{open:105.8,close:106.5,high:106.6,low:105.6});
    context.data={candles,symbol:'BTCUSDT',interval:'15m',price:106.5,spread:.0001,source:'TEST FIXTURE ONLY',timestamp:Date.now()};
    context.report={...Engine.evaluate(candles),eligible:true};
    return {context,get,stored,tick,run:source=>vm.runInContext(source,context)};
}
test('UI gates weak evidence, preserves precision, and expires saved-entry eligibility',()=>{
    const p=page();p.run('render(data,report)');assert.equal(p.get('saveTrade').disabled,false);
    p.get('positionSize').value='500';p.get('positionSize').handlers.input();assert.match(p.get('potential').textContent,/هزینه‌های مدل/);
    assert.equal(p.run('priceText(0.00001234)'),'۰٫۰۰۰۰۱۲۳۴');
    p.run('report.eligible=false;render(data,report)');assert.equal(p.get('saveTrade').disabled,true);assert.equal(p.get('entry').textContent,'—');
    p.run('report.eligible=true;render(data,report);data.timestamp=Date.now()-61000');p.tick();assert.equal(p.get('saveTrade').disabled,true);assert.match(p.get('quoteTime').textContent,/منقضی/);
});
test('UI clears results on market change and on a failed real-data request',async()=>{
    const p=page();p.run('render(data,report)');
    p.get('symbol').handlers.change();assert.equal(p.get('saveTrade').disabled,true);assert.equal(p.get('price').textContent,'—');
    p.context.SignalMarket.load=async()=>{throw Error('Network unavailable');};
    await p.get('run').handlers.click();assert.match(p.get('status').textContent,/Network unavailable/);assert.equal(p.get('status').className,'status error');assert.equal(p.get('saveTrade').disabled,true);assert.equal(p.get('run').disabled,false);
});
test('paper journal cannot claim execution and corrupted storage is not overwritten',()=>{
    const p=page();p.run('render(data,report)');p.get('positionSize').value='100';p.get('saveTrade').handlers.click();
    const journal=JSON.parse(p.stored.get('smcTrades'));assert.equal(journal.length,1);assert.equal(journal[0].paper,true);assert.equal(journal[0].status,'بررسی نشده');
    p.get('saveTrade').handlers.click();assert.equal(JSON.parse(p.stored.get('smcTrades')).length,1);
    p.stored.set('smcTrades','broken');p.get('saveTrade').handlers.click();assert.equal(p.stored.get('smcTrades'),'broken');
});
test('changing reward target clears old results and paper plans keep separate target values',()=>{
    const p=page();p.run('report.rr=3;render(data,report)');
    assert.match(p.get('targetLabel').textContent,/۳R/);
    p.get('positionSize').value='100';p.get('saveTrade').handlers.click();
    p.run('report.rr=7;render(data,report)');p.get('saveTrade').handlers.click();
    const trades=JSON.parse(p.stored.get('smcTrades'));assert.equal(trades.length,2);
    assert.deepEqual(trades.map(t=>t.rr),[3,7]);assert.notEqual(trades[0].target,trades[1].target);
    p.get('rr').value='5';p.get('rr').handlers.change();assert.equal(p.get('saveTrade').disabled,true);assert.equal(p.get('target').textContent,'—');
    assert.match(p.get('rrBadge').textContent,/۵R/);
});
