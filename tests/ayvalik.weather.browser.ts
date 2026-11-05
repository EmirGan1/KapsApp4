import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {parseWeather} from '../src/utils/ayvalikWeather';
import {weatherFixture} from './ayvalik.weather.fixture';
const vite=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:4205,strictPort:true},plugins:[{name:'cas-weather',configureServer(s){s.middlewares.use('/__cas',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__cas','<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="root"></div><script type="module" src="/tests/ayvalik.fixture.tsx"></script></body></html>'));});}}]});
await vite.listen();const browser=await chromium.launch({headless:true});
try {
  for(const [width,height] of [[1440,900],[768,1024],[390,844]]) {
    const page=await browser.newPage({viewport:{width,height},timezoneId:'America/New_York'}), errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('auth_token','session-token'));
    await page.clock.install({time:new Date('2026-11-05T09:00:00Z')});
    let count=0,failed=false,range='2026-11-05',stale=false;
    await page.route('**/api/**',route=> {
      if(route.request().url().endsWith('/weather')) {
        assert.equal(route.request().headers().authorization,'Bearer session-token'); count++;
        return route.fulfill({status:failed?503:200,json:failed?{success:false}:{success:true,data:parseWeather(weatherFixture(range,count===1?18:21)),fetchedAt:Date.now(),stale}});
      }
      return route.fulfill({json:{success:true,checkedIds:[],rooms:[],invites:[],messages:[],items:[]}});
    });
    await page.goto('http://127.0.0.1:4205/__cas?section=weather');
    const weather=page.getByRole('region',{name:'Ayvalık hava durumu',exact:true});
    await weather.getByRole('article',{name:'Ayvalık şu an'}).getByText('18°C',{exact:true}).waitFor();
    assert.equal(await weather.getByText(/Bu gün için henüz tahmin yok/).count(),3);
    assert.equal(await weather.getByRole('row').count(),25);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await weather.getByRole('article',{name:'Ayvalık şu an'}).scrollIntoViewIfNeeded();
    await page.screenshot({path:'/tmp/cas-weather-'+width+'.png'});
    await page.clock.fastForward(15*60*1000+1);await weather.getByRole('article',{name:'Ayvalık şu an'}).getByText('21°C',{exact:true}).waitFor();assert.equal(count,2);
    failed=true;await weather.getByRole('button',{name:'Hava durumunu yenile',exact:true}).click();await weather.getByText(/Güncel veriler alınamadı/).waitFor();await weather.getByText(/Eski veri —/).waitFor();assert.equal(await weather.getByRole('article',{name:'Ayvalık şu an'}).getByText('21°C',{exact:true}).count(),1);
    failed=false;range='2026-11-10';await weather.getByRole('button',{name:'Hava durumunu yenile',exact:true}).click();await weather.getByText(/Son başarılı veri alımı/).waitFor();assert.equal(await weather.getByText(/Bu gün için henüz tahmin yok/).count(),2);
    range='2026-11-12';await weather.getByRole('button',{name:'Hava durumunu yenile',exact:true}).click();await weather.getByText(/Son başarılı veri alımı/).waitFor();assert.equal(await weather.getByText(/Bu gün için henüz tahmin yok/).count(),0);
    await weather.getByRole('combobox',{name:'Saatlik tahmin günü'}).selectOption('2026-11-25');assert.equal(await weather.getByRole('row').count(),25);
    await weather.getByRole('heading',{name:'25–27 Kasım · Gezi tahmini'}).evaluate(el=>el.scrollIntoView({block:'start'}));
    await page.screenshot({path:'/tmp/cas-weather-trip-'+width+'.png'});
    stale=true;await weather.getByRole('button',{name:'Hava durumunu yenile',exact:true}).click();await weather.getByText(/Eski veri —/).waitFor();assert.deepEqual(errors,[]);
    console.log('PASS live weather, 15-minute refresh, outage/recovery, partial/full trip forecast, hourly and layout',width);
    await page.close();
  }
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/api/**',r=>r.fulfill({status:r.request().url().endsWith('/weather')?503:200,json:{success:false}}));
  await page.goto('http://127.0.0.1:4205/__cas?widget=1');await page.getByRole('region',{name:'Ayvalık hava durumu',exact:true}).getByText(/Güncel veriler alınamadı/).waitFor();
  assert.equal(await page.getByText('Şu an · Güncel model verisi',{exact:true}).count(),0);
  console.log('PASS widget uses shared weather; initial outage never fabricates current values');await page.close();
}finally{await browser.close();await vite.close();}
