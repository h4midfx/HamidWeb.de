(function(root){
    'use strict';
    function pick(values,rng=Math.random){
        const value=rng();
        if(!Number.isFinite(value)||value<0||value>=1)throw Error('انتخاب تصادفی نامعتبر است.');
        return values[Math.floor(value*values.length)];
    }
    function makePlan(data,{engine,rr,side,size,now=Date.now()}){
        if(!engine.REWARDS.includes(rr)||![1,-1].includes(side)||!Number.isFinite(size)||size<=0)throw Error('تنظیمات تمرین نامعتبر است.');
        if(!Number.isFinite(data.timestamp)||now-data.timestamp>=60000||data.timestamp>now+5000)throw Error('قیمت تازه نیست؛ دوباره دریافت کنید.');
        if(!Number.isFinite(data.price)||data.price<=0)throw Error('قیمت معتبر دریافت نشد.');
        const candles=engine.normalize(data.candles,data.interval,data.timestamp);
        const recent=candles.slice(-15);
        const atr=recent.slice(1).reduce((sum,c,i)=>sum+Math.max(c.high-c.low,Math.abs(c.high-recent[i].close),Math.abs(c.low-recent[i].close)),0)/14;
        if(!Number.isFinite(atr)||atr<=0)throw Error('نوسان معتبر برای محاسبه حد ضرر وجود ندارد.');
        const entry=data.price,distance=atr*1.5,stop=entry-side*distance,target=entry+side*rr*distance;
        if(stop<=0||target<=0||![stop,target].every(Number.isFinite))throw Error('هدف یا حد ضرر قابل محاسبه نیست؛ موقعیت دیگری بسازید.');
        return {mode:'random-paper',paper:true,symbol:data.symbol,interval:data.interval,source:data.source,side,rr,entry,stop,target,size,
            priceRisk:size*distance/entry,priceReward:size*distance*rr/entry,timestamp:data.timestamp,expiresAt:data.timestamp+60000,winProbability:null};
    }
    async function generate({market,engine,rr=null,size=100,rng=Math.random,now=()=>Date.now()}){
        if(!Number.isFinite(size)||size<=0)throw Error('مبلغ فرضی باید بیشتر از صفر باشد.');
        if(rr!==null&&!engine.REWARDS.includes(rr))throw Error('نسبت هدف نامعتبر است.');
        const symbol=pick(market.symbols,rng),side=pick([1,-1],rng),reward=rr??pick(engine.REWARDS,rng);
        const data=await market.load(symbol,'15m',undefined,undefined,true,1000);
        return makePlan(data,{engine,rr:reward,side,size,now:now()});
    }
    function mount(host,market,engine){
        host.lang='fa';host.dir='rtl';
        host.innerHTML=`<div class="random-heading"><div><p>قیمت واقعی بای‌بیت · انتخاب تصادفی</p><h2>موقعیت تصادفی برای تمرین</h2></div><span>فقط آزمایشی</span></div><p class="random-note">ارز، جهت و هدف به‌صورت تصادفی انتخاب می‌شوند؛ این بخش سیگنال استراتژی یا پیشنهاد سرمایه‌گذاری نیست و آزمون برد ۶۰٪ ندارد. قیمت ورود واقعی است؛ احتمال موفقیت مشخص نیست. سفارشی اجرا نمی‌شود.</p><div class="random-controls"><label>مبلغ فرضی به تتر<input class="random-size" type="number" min="0.01" step="any" value="100"></label><label>هدف تمرین<select class="random-rr"><option value="">تصادفی</option><option value="3">3R</option><option value="4">4R</option><option value="5">5R</option><option value="7">7R</option><option value="10">10R</option></select></label><button type="button" class="random-next">موقعیت تصادفی بعدی</button></div><p class="random-status" role="status" aria-live="polite">در حال دریافت اولین موقعیت تمرینی…</p><div class="random-output"></div>`;
        const button=host.querySelector('.random-next'),size=host.querySelector('.random-size'),rr=host.querySelector('.random-rr'),output=host.querySelector('.random-output'),status=host.querySelector('.random-status');
        const num=value=>value.toLocaleString('fa-IR',{maximumFractionDigits:value<1?8:4});
        const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        let current=null,busy=false;
        async function run(){
            if(busy)return;
            busy=true;current=null;output.innerHTML='';button.disabled=size.disabled=rr.disabled=true;
            status.textContent='در حال دریافت قیمت واقعی بای‌بیت…';
            try{
                current=await generate({market,engine,rr:rr.value===''?null:Number(rr.value),size:Number(size.value)});
                output.innerHTML=`<article><h3><bdi>${escape(current.symbol)}</bdi> · ${current.side===1?'خرید تصادفی':'فروش تصادفی'} · ${num(current.rr)}R</h3><p>برنامه فرضی، نه سیگنال معتبر · بازه ۱۵ دقیقه</p><dl><div><dt>ورود فرضی از قیمت واقعی</dt><dd>${num(current.entry)}</dd></div><div><dt>حد ضرر تمرینی</dt><dd>${num(current.stop)}</dd></div><div><dt>هدف تمرینی</dt><dd>${num(current.target)}</dd></div></dl><p>برای ${num(current.size)} تتر فرضی: ریسک قیمت ${num(current.priceRisk)} تتر / سود هدف ${num(current.priceReward)} تتر، قبل از هزینه‌ها.</p><small>حد ضرر: ۱٫۵ برابر میانگین دامنه واقعی ۱۴ کندل. منبع: ${escape(current.source)} · زمان ${new Date(current.timestamp).toLocaleString('fa-IR')}</small></article>`;
                status.textContent='موقعیت تصادفی ساخته شد؛ قیمت تا ۶۰ ثانیه اعتبار دارد. احتمال برد نامشخص است.';
            }catch(error){current=null;output.innerHTML='';status.textContent='موقعیت ساخته نشد؛ داده واقعی در دسترس نیست یا تنظیمات معتبر نیست. دوباره تلاش کنید.';}
            finally{busy=false;button.disabled=size.disabled=rr.disabled=false;}
        }
        button.addEventListener('click',run);
        for(const input of [size,rr])input.addEventListener('change',()=>{current=null;output.innerHTML='';status.textContent='تنظیمات تغییر کرد؛ موقعیت تصادفی بعدی را بسازید.';});
        setInterval(()=>{if(current&&Date.now()>=current.expiresAt){current=null;output.innerHTML='';status.textContent='قیمت موقعیت قبلی منقضی شد؛ برای قیمت تازه موقعیت دیگری بسازید.';}},1000);
        run();return {run};
    }
    const api={pick,makePlan,generate,mount};
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
    else{root.RandomPositions=api;document.querySelectorAll('[data-random-positions]').forEach(host=>mount(host,root.SignalMarket,root.SignalEngine));}
})(globalThis);
