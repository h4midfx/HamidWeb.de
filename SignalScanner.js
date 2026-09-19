(function(root) {
    'use strict';
    function create({ market, engine, onUpdate = () => {}, isVisible = () => true, now = () => Date.now() }) {
        const jobs = market.symbols.flatMap(symbol => ['15m','4h'].map(interval => ({symbol,interval,key:symbol+':'+interval})));
        const rows = new Map(jobs.map(job => [job.key,{...job,state:'pending'}]));
        const reports = new Map(); let running = null;
        function snapshot() {
            return jobs.flatMap(job => {
                const row = rows.get(job.key);
                if (row.state !== 'done') return engine.REWARDS.map(rr=>({...row,rr,active:false}));
                return row.reports.map(report=>{
                    const assessment = engine.qualify(row.data,report,now());
                    return {...row,report,rr:report.rr,...assessment,state:assessment.fresh?'done':'expired'};
                });
            });
        }
        function run() {
            if(running) return running;
            let index=0;
            async function worker() {
                while(index<jobs.length && isVisible()) {
                    const job=jobs[index++];
                    rows.set(job.key,{...job,state:'checking'});onUpdate(snapshot());
                    try {
                        const data=await market.load(job.symbol,job.interval,undefined,undefined,true);
                        data.candles=engine.normalize(data.candles,job.interval,data.timestamp);
                        if(data.candles.length<120) throw Error('برای بررسی، حداقل ۱۲۰ کندل بسته لازم است.');
                        const lastTime=data.candles.at(-1).time;
                        const previous=reports.get(job.key);
                        const results=previous?.time===lastTime?previous.reports:engine.REWARDS.map(rr=>({...engine.evaluate(data.candles,rr),rr}));
                        reports.set(job.key,{time:lastTime,reports:results});
                        rows.set(job.key,{...job,state:'done',data,reports:results});
                    } catch(error) {
                        rows.set(job.key,{...job,state:'error',error:'داده معتبر دریافت نشد؛ اتصال یا دسترسی به بای‌بیت را بررسی کنید.'});
                    }
                    onUpdate(snapshot());
                }
            }
            running=Promise.all([worker(),worker()]).finally(()=>{running=null;onUpdate(snapshot());});
            return running;
        }
        return {run,snapshot};
    }
    function diagnose(rows) {
        const tested = rows.filter(row=>row.report?.stats);
        const enough = tested.filter(row=>row.report.stats.closed>=20);
        return {
            tested: tested.length,
            insufficient: tested.filter(row=>row.report.stats.closed<20).length,
            belowWinRate: enough.filter(row=>!Number.isFinite(row.report.stats.winRate)||row.report.stats.winRate<.6).length,
            historicalPass: tested.filter(row=>row.report.eligible).length,
            active: rows.filter(row=>row.active).length,
            best: tested.slice().sort((a,b)=>Number(b.report.stats.closed>=20)-Number(a.report.stats.closed>=20)||(b.report.stats.returnPct??-Infinity)-(a.report.stats.returnPct??-Infinity)).slice(0,3)
        };
    }
    function mount(host, market, engine) {
        host.lang='fa';host.dir='rtl';
        host.innerHTML=`<div class="rr-heading"><div><p>فقط داده واقعی بای‌بیت</p><h2>هدف‌های ۳، ۴، ۵، ۷ و ۱۰R با برد تاریخی حداقل ۶۰٪</h2></div><span class="rr-badge">فیلتر برد تاریخی ≥ ۶۰٪</span></div><p class="rr-description">۱۲ ارز · بازه‌های ۱۵ دقیقه و ۴ ساعت · پنج هدف مستقل برای هر بازار · تا ۱۰٬۰۰۰ کندل واقعی برای هر بازه · شروع بدون کلیک؛ بررسی مجدد ۳۰ ثانیه پس از پایان هر دور، تا وقتی صفحه باز و قابل مشاهده است.</p><p class="rr-progress" role="status" aria-live="polite">در حال شروع بررسی بازارها…</p><div class="rr-results"></div><section class="rr-diagnostics" aria-label="نتایج بک‌تست"><h3>بک‌تست چه می‌گوید؟</h3><p class="rr-diagnosis"></p><div class="rr-history"></div></section><details class="rr-details" open><summary>نتایج کامل بک‌تست و علت نبود سیگنال</summary><div class="rr-table-wrap"><table><thead><tr><th>ارز</th><th>بازه</th><th>هدف</th><th>برد تاریخی / تعداد</th><th>بازده مدل</th><th>افت سرمایه</th><th>ضریب سود</th><th>بازه آزمون</th><th>علت / وضعیت</th></tr></thead><tbody></tbody></table></div></details><p class="rr-note">R یعنی چند برابر فاصله حد ضرر، پیش از هزینه‌ها؛ سود تضمین‌شده نیست. هر هدف بک‌تست جداگانه دارد. هدف‌های مختلف یک موقعیت، گزینه‌های جایگزین همان معامله هستند. فقط موقعیت‌های دارای داده تازه، روند و ساختار معتبر، اختلاف قیمت مناسب و نتیجه تاریخی قابل قبول نشان داده می‌شوند. نرخ برد از حداقل ۲۰ معامله بسته‌شده در ۳۰٪ پایانی داده‌ها، پس از هزینه‌های مدل محاسبه می‌شود؛ معاملات بسته‌شده در پایان نمونه در نرخ برد حساب نمی‌شوند. این درصد احتمال برد معامله بعدی نیست. بازده با کارمزد ۰٫۱٪ و لغزش ۰٫۰۵٪ در هر سمت مدل شده؛ هزینه تأمین مالی و لیکوییدشدن لحاظ نشده‌اند. اعتبار قیمت: حداکثر ۶۰ ثانیه.</p>`;
        const progress=host.querySelector('.rr-progress'),results=host.querySelector('.rr-results'),body=host.querySelector('tbody');
        const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const num=value=>!Number.isFinite(value)?'—':value.toLocaleString('fa-IR',{maximumFractionDigits:value<1?8:value<100?5:2});
        const frame=interval=>interval==='15m'?'۱۵ دقیقه':'۴ ساعت';
        const time=value=>new Date(value).toLocaleTimeString('fa-IR');
        const diagnosis=host.querySelector('.rr-diagnosis'),history=host.querySelector('.rr-history');
        const shortDate=value=>Number.isFinite(value)?new Date(value).toLocaleDateString('fa-IR'):'—';
        function paint(rows) {
            const active=rows.filter(row=>row.active),errors=rows.filter(row=>row.state==='error').length;
            const pending=rows.filter(row=>['pending','checking'].includes(row.state)).length;
            const expired=rows.filter(row=>row.state==='expired').length;
            const summary=`${num(rows.length-pending)} از ${num(rows.length)} ترکیب بازار و هدف بررسی شده · ${num(active.length)} موقعیت معتبر · ${num(errors)} خطای دریافت · ${num(expired)} نتیجه منقضی${document.hidden?' · بررسی در پس‌زمینه متوقف است':''}`;
            if(progress.textContent!==summary)progress.textContent=summary;
            const cards=active.length?active.map(row=>`<article class="rr-match"><div><b dir="ltr">${escape(row.symbol.replace('USDT',' / USDT'))}</b><span>${frame(row.interval)} · ${row.setup.side===1?'خرید':'فروش'} · هدف ${num(row.rr)}R</span></div><p class="rr-win">برد تاریخی: ${num(row.report.stats.winRate*100)}٪ · ${num(row.report.stats.wins)} برد از ${num(row.report.stats.closed)} معامله بسته‌شده</p><dl><div><dt>ورود</dt><dd>${num(row.setup.entry)}</dd></div><div><dt>حد ضرر</dt><dd>${num(row.setup.stop)}</dd></div><div><dt>هدف</dt><dd>${num(row.setup.target)}</dd></div></dl><small>قیمت به تتر · زمان بای‌بیت ${time(row.data.timestamp)}</small><a href="CryptoSignals.html?symbol=${encodeURIComponent(row.symbol)}&interval=${encodeURIComponent(row.interval)}&rr=${row.rr}">جزئیات این موقعیت ↗</a></article>`).join(''):`<p class="rr-empty">${pending?'بررسی بازارها ادامه دارد؛ هنوز موقعیت با نرخ برد تاریخی حداقل ۶۰٪ پیدا نشده است.':errors===rows.length?'داده بای‌بیت در دسترس نیست؛ تشخیص موقعیت ممکن نیست.':expired===rows.length?'نتایج قبلی منقضی شده‌اند؛ در انتظار داده تازه.':'در بازارهای بررسی‌شده، اکنون موقعیت با نرخ برد تاریخی حداقل ۶۰٪ وجود ندارد.'}${errors>0&&errors<rows.length?' بازارهای دارای خطای دریافت قابل ارزیابی نیستند.':''}</p>`;
            if(results.innerHTML!==cards) results.innerHTML=cards;
            const diagnostics=diagnose(rows);
            diagnosis.textContent=diagnostics.tested
                ? 'از '+num(diagnostics.tested)+' بک‌تست: '+num(diagnostics.insufficient)+' نمونه کمتر از ۲۰ معامله دارد؛ '+num(diagnostics.belowWinRate)+' نمونه کافی، برد کمتر از ۶۰٪ دارد؛ '+num(diagnostics.historicalPass)+' مورد شرایط تاریخی را گذرانده و '+num(diagnostics.active)+' مورد اکنون سیگنال معتبر است.'
                : 'بک‌تست در حال اجرا است؛ هیچ سود فرضی نمایش داده نمی‌شود.';
            const historical=diagnostics.best.map(row=>{
                const stats=row.report.stats;
                return '<article class="rr-history-card"><bdi>'+escape(row.symbol)+' · '+escape(row.interval)+' · '+num(row.rr)+'R</bdi><strong>بازده مدل: '+num(stats.returnPct)+'٪</strong><span>برد: '+(stats.winRate===null?'—':num(stats.winRate*100)+'٪')+' · '+num(stats.closed)+' معامله بسته‌شده</span><small>'+shortDate(row.report.start)+' تا '+shortDate(row.report.end)+'</small><p>'+(stats.closed<20?'نمونه ناکافی؛ نتیجه قابل تأیید نیست.':row.report.eligible?'شرایط تاریخی برقرار است؛ برای ورود باید سیگنال فعلی هم معتبر باشد.':'شرایط تاریخی تأیید نشده است.')+'</p><small>مقایسه تاریخی، نه پیشنهاد ورود. نتایج مرتب‌شده پس از مشاهده همین داده‌ها هستند.</small></article>';
            }).join('');
            if(history.innerHTML!==historical)history.innerHTML=historical;
            const markup=rows.map(row=>{
                let reason;
                if(row.state==='error') reason=row.error;
                else if(row.state==='expired') reason='قیمت منقضی شده؛ در انتظار بررسی بعدی';
                else if(row.state==='pending'||row.state==='checking') reason=row.state==='checking'?'در حال بررسی…':'در صف بررسی';
                else reason=row.active?'موقعیت معتبر':row.blockers.join(' • ');
                return `<tr><td><bdi>${escape(row.symbol)}</bdi></td><td>${frame(row.interval)}</td><td>${num(row.rr)}R</td><td>${row.report && row.report.stats.winRate !== null ? num(row.report.stats.winRate*100)+"٪ / "+num(row.report.stats.closed) : "—"}</td><td>${row.report?num(row.report.stats.returnPct)+"٪":"—"}</td><td>${row.report?num(row.report.stats.maxDrawdown*100)+"٪":"—"}</td><td>${row.report?.stats.profitFactor===Infinity?"بدون زیان در نمونه":num(row.report?.stats.profitFactor)}</td><td>${row.report?shortDate(row.report.start)+" – "+shortDate(row.report.end):"—"}</td><td>${escape(reason)}</td></tr>`;
            }).join('');
            if(body.innerHTML!==markup) body.innerHTML=markup;
        }
        const scanner=create({market,engine,onUpdate:paint,isVisible:()=>!document.hidden});
        let timer;
        async function cycle() {clearTimeout(timer);if(document.hidden)return;await scanner.run();timer=setTimeout(cycle,30000);}
        document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else cycle();});
        setInterval(()=>paint(scanner.snapshot()),1000);
        paint(scanner.snapshot());cycle();
        return scanner;
    }
    const api={create,mount,diagnose};
    if(typeof module!=='undefined' && module.exports) module.exports=api;
    else {root.SignalScanner=api;document.querySelectorAll('[data-signal-scanner]').forEach(host=>mount(host,root.SignalMarket,root.SignalEngine));}
})(globalThis);
