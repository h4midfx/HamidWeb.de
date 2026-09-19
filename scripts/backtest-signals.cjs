'use strict';
const fs=require('node:fs'),path=require('node:path');
const Market=require('../SignalMarket'),Engine=require('../SignalEngine');
const output=path.join(__dirname,'..','.artifacts','backtest');
fs.mkdirSync(output,{recursive:true});
const jobs=Market.symbols.flatMap(symbol=>['15m','4h'].map(interval=>({symbol,interval})));
const results=[],errors=[];let index=0;
async function worker(){
    while(index<jobs.length){
        const {symbol,interval}=jobs[index++];
        try{
            const data=await Market.load(symbol,interval);
            const candles=Engine.normalize(data.candles,interval,data.timestamp);
            fs.writeFileSync(path.join(output,symbol+'-'+interval+'.json'),JSON.stringify({...data,candles}));
            for(const rr of Engine.REWARDS){
                const report=Engine.evaluate(candles,rr);
                const assessment=Engine.qualify({...data,candles},report);
                results.push({symbol,interval,rr,candles:candles.length,source:data.source,asOf:data.timestamp,start:report.start,end:report.end,...report.stats,eligible:report.eligible,active:assessment.active,reason:report.reason,currentSetup:assessment.setup.reason});
            }
            console.log(symbol,interval,candles.length,'candles evaluated');
        }catch(error){errors.push({symbol,interval,error:error.message});console.log(symbol,interval,'unavailable:',error.message);}
    }
}
(async()=>{
    await Promise.all([worker(),worker()]);
    const report={generatedAt:new Date().toISOString(),model:{fee:Engine.FEE,slippage:Engine.SLIPPAGE,riskPerTrade:.01,leverage:1,fundingIncluded:false,liquidationModeled:false,ambiguousBar:'stop first',rewards:Engine.REWARDS,minWinRate:.6,minTrades:20,validation:'last 30 percent; no parameter optimization'},results,errors};
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,(_,v)=>v===Infinity?'Infinity':v,2));
    const columns=['symbol','interval','rr','candles','closed','wins','winRate','profitFactor','returnPct','maxDrawdown','eligible','active','start','end','reason'];
    const csv=columns.join(',')+'\n'+results.map(row=>columns.map(key=>'"'+String(row[key]??'').replaceAll('"','""')+'"').join(',')).join('\n');
    fs.writeFileSync(path.join(output,'report.csv'),'\uFEFF'+csv);
    const ranked=results.filter(r=>r.closed>=20).sort((a,b)=>b.returnPct-a.returnPct);
    console.log(JSON.stringify({variants:results.length,errors,passed:results.filter(r=>r.eligible),best:ranked.slice(0,5)},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
