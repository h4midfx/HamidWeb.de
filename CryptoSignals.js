'use strict';
const $ = id => document.getElementById(id);
let currentSetup = null, currentData = null, currentReport = null;
const number = (value, digits = 2) => Number.isFinite(value) ? value.toLocaleString('fa-IR', { maximumFractionDigits: digits }) : '—';
const priceText = value => number(value, value < 1 ? 8 : value < 100 ? 5 : 2);
const selectedRR = () => Number($('rr').value) || SignalEngine.RR;
const dateText = value => new Date(value).toLocaleString('fa-IR');
const pct = value => number(value) + ' %';
const escapeText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(text, error = false) { $('status').textContent = text; $('status').className = error ? 'status error' : 'status'; }
function clearAnalysis() {
    currentSetup = null; currentData = null; currentReport = null;
    $('saveTrade').disabled = true;
    for (const id of ['price','entry','stop','target','trades','return','winRate','drawdown','profitFactor']) { $(id).textContent = '—'; $(id).className = ''; }
    $('direction').textContent = 'انتظار'; $('direction').className = '';
    $('reason').textContent = 'هنوز موقعیت فعلی بررسی نشده است.';
    $('eligibility').textContent = 'ورود فقط پس از بررسی داده‌های معتبر و نتایج مجاز است.';
    $('quoteTime').textContent = 'هنوز قیمت دریافت نشده';
    $('dataInfo').textContent = 'در انتظار بررسی داده‌ها'; $('spread').textContent = 'اختلاف خرید و فروش —';
    $('testPeriod').textContent = 'هنوز آزمون تاریخی این بازار انجام نشده است.'; $('fullResult').textContent = '';
    $('chartRange').textContent = '۱۲۰ کندل بسته اخیر';
    $('chart').innerHTML = '<div class="empty">هنوز داده بازار تأیید نشده است.<small>تحلیل بازار انتخاب‌شده را آغاز کنید.</small></div>';
    $('marketTitle').textContent = $('symbol').value.replace('USDT',' / USDT');
    $('rrBadge').textContent='هدف '+number(selectedRR())+'R';
    $('targetLabel').textContent='حد سود · '+number(selectedRR())+'R';
    updatePotential();
}
function chart(candles) {
    const rows = candles.slice(-120), low = Math.min(...rows.map(c=>c.low)), high = Math.max(...rows.map(c=>c.high));
    const pad = Math.max((high-low)*.1, high*.00001), min = low-pad, max = high+pad;
    const y = value => 250 - (value-min)/(max-min)*230, x = i => 8+i*530/rows.length;
    let content = '';
    for(let i=0;i<5;i++) {
        const v=min+(max-min)*i/4, py=y(v);
        content += `<line x1="0" x2="540" y1="${py}" y2="${py}" stroke="#25323e" stroke-dasharray="3 5"/><text x="550" y="${py+4}" fill="#9aaab8" font-size="10">${priceText(v)}</text>`;
    }
    rows.forEach((c,i)=>{
        const color=c.close>=c.open?'#adf4ca':'#ff9393';
        content+=`<g><title>${escapeText(dateText(c.time))}: O ${c.open} H ${c.high} L ${c.low} C ${c.close}</title><line x1="${x(i)}" x2="${x(i)}" y1="${y(c.high)}" y2="${y(c.low)}" stroke="${color}"/><rect x="${x(i)-1.4}" y="${Math.min(y(c.open),y(c.close))}" width="2.8" height="${Math.max(1,Math.abs(y(c.open)-y(c.close)))}" fill="${color}"/></g>`;
    });
    $('chart').innerHTML = `<svg viewBox="0 0 635 270" role="img" aria-label="نمودار ۱۲۰ کندل بسته اخیر بای‌بیت"><title>کندل‌های واقعی بای‌بیت؛ قیمت به تتر</title>${content}</svg>`;
    $('chartRange').textContent = dateText(rows[0].time) + ' – ' + dateText(rows.at(-1).time);
}
function render(data, report) {
    currentData = data; currentReport = report;
    const assessment = SignalEngine.qualify(data, report);
    const { setup, fresh, spreadOK, active: valid, expiresAt } = assessment;
    $('rrBadge').textContent='هدف '+number(setup.rr)+'R';
    $('targetLabel').textContent='حد سود · '+number(setup.rr)+'R';
    currentSetup = valid ? { ...setup, symbol: data.symbol, interval: data.interval, source: data.source, expiresAt } : null;
    $('direction').textContent = valid ? (setup.side===1?'خرید':'فروش') : 'انتظار';
    $('direction').className = valid ? (setup.side===1?'positive':'negative') : '';
    $('reason').textContent = setup.side ? (valid ? setup.reason : 'ساختار شناسایی شد: ' + setup.reason + '؛ ورود هنوز مجاز نیست.') : setup.reason;
    $('eligibility').textContent = assessment.blockers.length ? assessment.blockers.join(' • ') : report.reason;
    for(const id of ['entry','stop','target']) $(id).textContent = valid ? priceText(setup[id]) : '—';
    $('saveTrade').disabled = !valid;
    $('price').textContent = priceText(data.price);
    $('quoteTime').textContent = 'تتر · زمان قیمت ' + dateText(data.timestamp);
    $('dataInfo').textContent = data.source + ' · ' + data.candles.length + ' کندل بسته · بررسی‌شده';
    $('spread').textContent = 'اختلاف خرید و فروش ' + number(data.spread*100,4) + ' %';
    const stats=report.stats;
    $('trades').textContent=stats.count;
    $('return').textContent=stats.count?pct(stats.returnPct):'—';
    $('return').className=stats.count?(stats.returnPct>=0?'positive':'negative'):'';
    $('winRate').textContent=stats.winRate===null?'—':pct(stats.winRate*100);
    $('drawdown').textContent=stats.count?pct(stats.maxDrawdown*100):'—';
    $('profitFactor').textContent=stats.profitFactor===null?'قابل محاسبه نیست':stats.profitFactor===Infinity?'بدون زیان در نمونه':number(stats.profitFactor);
    $('testPeriod').textContent = 'هدف '+number(report.rr ?? SignalEngine.RR)+'R · '+(report.start ? dateText(report.start)+' – '+dateText(report.end) : 'داده کافی نیست') + ' · '+stats.closed+' معامله بسته‌شده، '+stats.forced+' ارزیابی در پایان بازه.';
    const full=SignalEngine.summarize(report.full);
    $('fullResult').textContent='کل بازه داده: '+full.count+' معامله شبیه‌سازی‌شده · '+(full.count?pct(full.returnPct):'بازده قابل محاسبه نیست')+'؛ استراتژی روی این بازه بهینه‌سازی نشده است.';
    chart(data.candles); updatePotential();
}
function updatePotential() {
    const size = Number($('positionSize').value), s = currentSetup;
    if (!s || !Number.isFinite(size) || size<=0) { $('potential').textContent='برای محاسبه، موقعیت معتبر و مبلغ پوزیشن لازم است.'; return; }
    const risk = size*Math.abs(s.entry-s.stop)/s.entry, reward=size*Math.abs(s.target-s.entry)/s.entry;
    const units=size/s.entry, side=s.side;
    const entryFill=s.entry*(1+side*SignalEngine.SLIPPAGE);
    const stopFill=s.stop*(1-side*SignalEngine.SLIPPAGE), targetFill=s.target*(1-side*SignalEngine.SLIPPAGE);
    const loss=units*(side*(entryFill-stopFill)+SignalEngine.FEE*(entryFill+stopFill));
    const gain=units*(side*(targetFill-entryFill)-SignalEngine.FEE*(entryFill+targetFill));
    $('potential').textContent=`ریسک قیمت ${number(risk)} USDT · هدف ${number(s.rr)}R ${number(reward)} USDT. با هزینه‌های مدل: زیان ${number(loss)} / سود هدف ${number(gain)} USDT (خالص ${number(gain/loss)}R). بدون هزینه تأمین مالی.`;
}
function readTrades() {
    try {
        const value=JSON.parse(localStorage.getItem('smcTrades')||'[]');
        if(!Array.isArray(value)) throw Error();
        return value.filter(t=>t && SignalMarket.symbols.includes(t.symbol) && ['15m','4h'].includes(t.interval) && ['entry','stop','target','size'].every(k=>Number.isFinite(t[k])&&t[k]>0)).slice(-200);
    } catch { $('journalStatus').textContent='دفتر معاملات قابل خواندن نیست؛ داده‌های قبلی بازنویسی نمی‌شوند.'; return null; }
}
function renderTrades() {
    const trades=readTrades();
    $('tradeRows').innerHTML=trades?.length ? trades.slice().reverse().map((t,i)=>`<tr><td>${escapeText(t.symbol)} · ${escapeText(t.interval)} · ${number(t.rr??SignalEngine.RR)}R<small>${escapeText(t.created)}</small></td><td>${escapeText(t.side===1?'خرید':t.side===-1?'فروش':'رکورد قدیمی')}<small>${number(t.size)} USDT</small></td><td>${priceText(t.entry)} / ${priceText(t.stop)} / ${priceText(t.target)}</td><td><small>${t.paper?'برنامه ذخیره‌شده · بررسی نشده':'رکورد قدیمی · نتیجه تأیید نشده'}</small><button class="delete" data-delete="${trades.length-1-i}">حذف</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">هنوز برنامه‌ای ذخیره نشده است.</td></tr>';
}
$('tradeRows').addEventListener('click',event=>{
    const index=event.target.dataset.delete;
    if(index===undefined) return;
    const trades=readTrades(); if(!trades) return;
    trades.splice(Number(index),1);
    try { localStorage.setItem('smcTrades',JSON.stringify(trades));renderTrades(); } catch { $('journalStatus').textContent='ذخیره دفتر معاملات ممکن نشد.'; }
});
$('saveTrade').addEventListener('click',()=>{
    const size=Number($('positionSize').value), setup=currentSetup;
    if(!setup || Date.now()>=setup.expiresAt) { expire(); status('اعتبار موقعیت تمام شده؛ دوباره تحلیل کنید.',true); return; }
    if(!Number.isFinite(size)||size<=0){status('مبلغ معتبر پوزیشن را وارد کنید.',true);return;}
    const trades=readTrades(); if(!trades) return;
    if(trades.some(t=>t.symbol===setup.symbol&&t.interval===setup.interval&&t.time===setup.time&&(t.rr??SignalEngine.RR)===setup.rr)) {status('این برنامه قبلاً ذخیره شده است.');return;}
    trades.push({...setup,size,paper:true,created:dateText(Date.now()),status:'بررسی نشده'});
    try{localStorage.setItem('smcTrades',JSON.stringify(trades.slice(-200)));renderTrades();status('برنامه آزمایشی ذخیره شد؛ هیچ سفارشی اجرا نشده است.');}catch{status('ذخیره‌سازی روی این دستگاه ممکن نیست.',true);}
});
function expire() {
    currentSetup=null;$('saveTrade').disabled=true;$('direction').textContent='انتظار';$('direction').className='';
    for(const id of ['entry','stop','target']) $(id).textContent='—';
    $('eligibility').textContent='قیمت منقضی شده؛ تحلیل را تازه کنید.';updatePotential();
}
setInterval(()=>{if(currentData && (Date.now()-currentData.timestamp>=60000 || (currentSetup && Date.now()>=currentSetup.expiresAt))) {expire();$('quoteTime').textContent='منقضی · زمان قیمت '+dateText(currentData.timestamp);}},1000);
$('positionSize').addEventListener('input',updatePotential);
for(const id of ['symbol','interval','rr']) $(id).addEventListener('change',()=>{clearAnalysis();status('بازار تغییر کرد؛ دوباره تحلیل کنید.');});
$('run').addEventListener('click',async()=>{
    clearAnalysis();for(const id of ['run','symbol','interval','rr']) $(id).disabled=true;
    $('run').textContent='در حال بررسی داده‌ها …';status('در حال دریافت کندل‌های واقعی و قیمت فعلی از بای‌بیت …');
    try{
        const data=await SignalMarket.load($('symbol').value,$('interval').value,undefined,undefined,true);
        data.candles=SignalEngine.normalize(data.candles,data.interval,data.timestamp);
        if(data.candles.length<120) throw Error('کندل بسته کافی برای بررسی وجود ندارد.');
        render(data,SignalEngine.evaluate(data.candles,selectedRR()));status('داده‌ها بررسی شدند؛ قیمت ۶۰ ثانیه اعتبار دارد. برای تازه‌سازی دوباره تحلیل کنید.');
    }catch(error){clearAnalysis();const message=error.name==='TimeoutError'?'زمان دریافت داده به پایان رسید.':error.name==='TypeError'?'ارتباط با بای‌بیت برقرار نشد.':error.message;status('تحلیل انجام نشد: '+message+' هیچ قیمت نمایشی یا جایگزین نشان داده نمی‌شود.',true);}
    finally{for(const id of ['run','symbol','interval','rr']) $(id).disabled=false;$('run').textContent='تحلیل بازار ↗';}
});
if (typeof location !== 'undefined') {
    const selected = new URLSearchParams(location.search);
    if (SignalMarket.symbols.includes(selected.get('symbol'))) $('symbol').value=selected.get('symbol');
    if (['15m','4h'].includes(selected.get('interval'))) $('interval').value=selected.get('interval');
    if (SignalEngine.REWARDS.includes(Number(selected.get('rr')))) $('rr').value=selected.get('rr');
}
clearAnalysis();renderTrades();
if (typeof location !== 'undefined') $('run').click();
