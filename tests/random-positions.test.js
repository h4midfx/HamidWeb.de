const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Random=require('../RandomPositions'),Engine=require('../SignalEngine');
function data(now=Date.now()){
    const end=Math.floor(now/900000)*900000;
    return {symbol:'BTCUSDT',interval:'15m',source:'TEST FIXTURE ONLY',timestamp:now,price:100,
        candles:Array.from({length:60},(_,i)=>({time:end-(60-i)*900000,open:100,close:100,high:101,low:99}))};
}
test('random plans preserve requested reward ratios on both sides and have no win claim',()=>{
    for(const rr of Engine.REWARDS)for(const side of [1,-1]){
        const plan=Random.makePlan(data(),{engine:Engine,rr,side,size:100});
        assert.equal(plan.paper,true);assert.equal(plan.mode,'random-paper');assert.equal(plan.winProbability,null);
        assert.equal(plan.entry,100);assert.equal(plan.side,side);
        assert.equal(Math.abs(plan.target-plan.entry)/Math.abs(plan.entry-plan.stop),rr);
        assert.equal(plan.priceReward/plan.priceRisk,rr);
    }
});
test('random generator uses real market dependency and a short history, never strategy approval',async()=>{
    const choices=[.99,.99,0];let args;
    const market={symbols:['BTCUSDT','ETHUSDT'],load:async(...a)=>{args=a;return {...data(),symbol:a[0]};}};
    const plan=await Random.generate({market,engine:{...Engine,evaluate(){throw Error('must not fake a backtest');}},rng:()=>choices.shift()});
    assert.equal(args[0],'ETHUSDT');assert.equal(args[1],'15m');assert.equal(args[5],1000);
    assert.equal(plan.side,-1);assert.equal(plan.rr,3);assert.equal(plan.symbol,'ETHUSDT');
});
test('stale prices, invalid size, and nonpositive price levels cannot create paper plans',()=>{
    const options={engine:Engine,rr:3,side:1,size:100};
    assert.throws(()=>Random.makePlan(data(Date.now()-61000),options));
    assert.throws(()=>Random.makePlan(data(),{...options,size:Infinity}));
    assert.throws(()=>Random.makePlan(data(),{...options,rr:6}));
    assert.throws(()=>Random.makePlan({...data(),price:1},{...options,side:-1}));
    assert.throws(()=>Random.pick([1,2],()=>1));
});
test('network failures return no invented random position',async()=>{
    await assert.rejects(Random.generate({market:{symbols:['BTCUSDT'],load:async()=>{throw Error('offline');}},engine:Engine}),/offline/);
});
test('Persian practice component starts automatically, clears failures, and expires old quotes',async()=>{
    let clock=Date.now(),tick,fail=false;
    const nodes=new Map();const get=key=>{if(!nodes.has(key))nodes.set(key,{value:key==='.random-size'?'100':'',textContent:'',innerHTML:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}});return nodes.get(key);};
    const host={innerHTML:'',querySelector:get};
    const FakeDate=class extends Date{static now(){return clock;}};
    const context=vm.createContext({module:{exports:{}},Date:FakeDate,setInterval:fn=>{tick=fn;}});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../RandomPositions.js'),'utf8'),context);
    const market={symbols:['BTCUSDT'],load:async()=>{if(fail)throw Error('offline');return data(clock);}};
    const component=context.module.exports.mount(host,market,Engine);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(host.lang,'fa');assert.match(get('.random-output').innerHTML,/BTCUSDT/);
    assert.match(get('.random-output').innerHTML,/نه سیگنال معتبر/);assert.equal(get('.random-next').disabled,false);
    clock+=61000;tick();assert.equal(get('.random-output').innerHTML,'');assert.match(get('.random-status').textContent,/منقضی/);
    await component.run();assert.match(get('.random-output').innerHTML,/BTCUSDT/);
    fail=true;await component.run();assert.equal(get('.random-output').innerHTML,'');assert.match(get('.random-status').textContent,/ساخته نشد/);
});
