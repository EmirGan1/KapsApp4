import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {parseWeather, fetchMultiSourceAyvalikWeather} from '../src/utils/ayvalikWeather';
import {weatherFixture} from './ayvalik.weather.fixture';

const vite = await createServer({
  logLevel: 'error',
  server: {host: '127.0.0.1', port: 4205, strictPort: true},
  plugins: [
    {
      name: 'cas-weather',
      configureServer(s) {
        s.middlewares.use('/__cas', async (_req, res) => {
          res.setHeader('Content-Type', 'text/html');
          res.end(
            await s.transformIndexHtml(
              '/__cas',
              '<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="root"></div><script type="module" src="/tests/ayvalik.fixture.tsx"></script></body></html>'
            )
          );
        });
      }
    }
  ]
});

await vite.listen();
const browser = await chromium.launch({headless: true});
try {
  const sampleData = parseWeather(weatherFixture('2026-11-12', 17));
  const sampleMulti = await fetchMultiSourceAyvalikWeather(
    async () => new Response('{}', {status: 200}),
    sampleData,
    Date.now()
  );

  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844]
  ]) {
    const page = await browser.newPage({viewport: {width, height}, timezoneId: 'Europe/Istanbul'});
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('auth_token', 'session-token'));

    let syncCount = 0;
    await page.route('**/api/**', route => {
      if (route.request().url().includes('/api/ayvalik/weather')) {
        assert.equal(route.request().headers().authorization, 'Bearer session-token');
        syncCount++;
        return route.fulfill({
          status: 200,
          json: {
            success: true,
            data: sampleData,
            fetchedAt: Date.now(),
            stale: false,
            multiSource: sampleMulti
          }
        });
      }
      return route.fulfill({
        json: {success: true, checkedIds: [], rooms: [], invites: [], messages: [], items: []}
      });
    });

    await page.goto('http://127.0.0.1:4205/__cas?section=weather');
    const weather = page.getByRole('region', {name: '25-27 Kasım Ayvalık Hava Durumu', exact: true});
    await weather.waitFor();

    // Verify embedded comparison box is present in the top header and click to expand
    const consensusToggle = weather.getByRole('button', {name: /Çoklu Hava Durumu Kaynakları Karşılaştırma/});
    await consensusToggle.waitFor();
    await consensusToggle.click();

    // Verify all 5 meteorological sources are rendered in the expanded comparison table
    await weather.getByText('ECMWF IFS & SEAS5 Ensemble').first().waitFor();
    await weather.getByText('NOAA GFS Seamless (NCEP)').first().waitFor();
    await weather.getByText('CMC GEM Global Ensemble').first().waitFor();
    await weather.getByText('Copernicus ERA5 & MGM Klimatoloji').first().waitFor();
    await weather.getByText('MET Norway (Yr.no) & Ege Deniz Analizi').first().waitFor();

    // Verify all 3 trip day cards (25, 26, 27 Kasım) are rendered prominently
    await weather.getByRole('button', {name: /25 Kasım 2026, Çarşamba detaylı saatlik/}).waitFor();
    await weather.getByRole('button', {name: /26 Kasım 2026, Perşembe detaylı saatlik/}).waitFor();
    await weather.getByRole('button', {name: /27 Kasım 2026, Cuma detaylı saatlik/}).waitFor();

    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path: '/tmp/cas-weather-' + width + '.png'});

    // Trigger manual live synchronization
    const prevSyncCount = syncCount;
    await weather.getByRole('button', {name: /Tüm Kaynaklardan Şimdi Senkronize Et/}).click();
    await page.waitForFunction(() => true);
    assert.ok(syncCount >= prevSyncCount + 1);

    // Open 26 Kasım modal and switch to 24-hour view
    await weather.getByRole('button', {name: /26 Kasım 2026, Perşembe detaylı saatlik/}).click();
    const modal = page.getByRole('dialog');
    await modal.waitFor();
    await modal.getByRole('button', {name: /Tam 24 Saat/}).click();
    await modal.getByRole('button', {name: 'Detay kartını kapat'}).click();

    assert.deepEqual(errors, []);
    console.log('PASS multi-source 25-27 Kasım weather consensus, live sync, modal & layout', width);
    await page.close();
  }
} finally {
  await browser.close();
  await vite.close();
}
