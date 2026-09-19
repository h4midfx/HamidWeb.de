const { test }=require('node:test');
const assert=require('node:assert/strict');
const Market=require('../SignalMarket');
const now=1800000000000;
const response=list=>({retCode:0,time:now,result:{category:'linear',symbol:'BTCUSDT',list}});
test('market data uses one real exchange and preserves source timestamps',async()=>{
    const urls=[];
    const fetcher=async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('kline')?response([['1799999100000','100','102','99','101','23']]):response([{symbol:'BTCUSDT',lastPrice:'101',bid1Price:'100.99',ask1Price:'101.01'}])};};
    const data=await Market.load('BTCUSDT','15m',fetcher,()=>now);
    assert.equal(data.price,101);assert.equal(data.candles[0].volume,23);assert.equal(data.timestamp,now);
    assert.equal(urls.length,2);assert.ok(urls.every(u=>u.startsWith('https://api.bybit.com/v5/market/')&&u.includes('category=linear')));
});
test('network failure never falls back to generated or other-market prices',async()=>{
    let calls=0;await assert.rejects(Market.load('BTCUSDT','15m',async()=>{calls++;return {ok:false,status:403};},()=>now),/403/);assert.equal(calls,1);
});
test('rejects stale, wrong-market and error exchange responses',()=>{
    for(const payload of [{...response([1]),time:now-61000},{...response([1]),retCode:10001},{...response([1]),result:{category:'spot',list:[1]}},{...response([1]),result:{category:'linear',symbol:'ETHUSDT',list:[1]}}]) assert.throws(()=>Market.validate(payload,'BTCUSDT',now));
});
test('rejects malformed or crossed ticker prices',async()=>{
    for(const bid of ['NaN','102']) {
        const fetcher=async url=>({ok:true,json:async()=>url.includes('kline')?response([['1799999100000','100','102','99','101','23']]):response([{symbol:'BTCUSDT',lastPrice:'101',bid1Price:bid,ask1Price:'101'}])});
        await assert.rejects(Market.load('BTCUSDT','15m',fetcher,()=>now));
    }
});
test('scanner reuses closed history only until next candle and always requests a fresh ticker',async()=>{
    let clock=now;const urls=[];
    const fetcher=async url=>{urls.push(url);return {ok:true,json:async()=>({retCode:0,time:clock,result:{category:'linear',symbol:'BTCUSDT',list:url.includes('kline')?[[String(clock-900000),'100','102','99','101','23']]:[{symbol:'BTCUSDT',lastPrice:'101',bid1Price:'100.99',ask1Price:'101.01'}]}})};};
    await Market.load('BTCUSDT','15m',fetcher,()=>clock,true);assert.equal(urls.length,2);
    await Market.load('BTCUSDT','15m',fetcher,()=>clock,true);assert.equal(urls.length,3);assert.match(urls[2],/tickers/);
    clock+=900000;await Market.load('BTCUSDT','15m',fetcher,()=>clock,true);assert.equal(urls.length,5);
});
test('extended history retrieves ten distinct pages before the latest ticker',async()=>{
    let pages=0,tickers=0;
    const fetcher=async url=>({ok:true,json:async()=>{
        if(url.includes('tickers')){tickers++;return response([{symbol:'BTCUSDT',lastPrice:'101',bid1Price:'100.99',ask1Price:'101.01'}]);}
        const offset=pages++*1000;
        return response(Array.from({length:1000},(_,i)=>[String(now-(offset+i+1)*900000),'100','102','99','101','23']));
    }});
    const data=await Market.load('BTCUSDT','15m',fetcher,()=>now);
    assert.equal(pages,10);assert.equal(tickers,1);assert.equal(data.candles.length,10000);
    assert.equal(new Set(data.candles.map(c=>c.time)).size,10000);
});
test('failed older page cannot silently become a successful extended backtest',async()=>{
    let calls=0;
    const fetcher=async()=>{calls++;if(calls===2)return {ok:false,status:500};return {ok:true,json:async()=>response(Array.from({length:1000},(_,i)=>[String(now-(i+1)*900000),'100','102','99','101','23']))};};
    await assert.rejects(Market.load('BTCUSDT','15m',fetcher,()=>now),/500/);
    assert.equal(calls,2);
});
test('practice requests fetch one history page without weakening the default backtest history',async()=>{
    let pages=0;
    const fetcher=async url=>({ok:true,json:async()=>{
        if(url.includes('tickers'))return response([{symbol:'BTCUSDT',lastPrice:'101',bid1Price:'100.99',ask1Price:'101.01'}]);
        pages++;return response(Array.from({length:1000},(_,i)=>[String(now-(i+1)*900000),'100','102','99','101','23']));
    }});
    const d=await Market.load('BTCUSDT','15m',fetcher,()=>now,false,1000);
    assert.equal(pages,1);assert.equal(d.candles.length,1000);assert.equal(Market.HISTORY_LIMIT,10000);
    await assert.rejects(Market.load('BTCUSDT','15m',fetcher,()=>now,false,1500));
});
