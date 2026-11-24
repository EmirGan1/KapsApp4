import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Exercise the real app, CSS, header and dock; API data is unrelated to geometry.
const vite = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await vite.listen();
const base = `http://127.0.0.1:${(vite.httpServer!.address() as any).port}`;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
    for (const mode of ['iphone-browser', 'iphone-pwa', 'android-pwa']) {
      const standalone = mode.endsWith('pwa');
      const iosStandalone = mode === 'iphone-pwa';
      const context = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true,
        userAgent: mode.startsWith('iphone')
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
          : 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36',
      });
      await context.addInitScript(({ standalone }) => {
        localStorage.setItem('lan_token', 'mock-layout');
        localStorage.setItem('lan_username', 'Layout tester');
        localStorage.setItem('lan_user_id', '1');
        Object.defineProperty(navigator, 'standalone', { value: standalone });
        // Reproduce an OS screen larger than the actual PWA layout viewport.
        Object.defineProperty(screen, 'height', { get: () => innerHeight + 44 });
      }, { standalone });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('daily-quote') ? { quote: 'Layout test', author: 'Test' } : [] }));
      await page.goto(base);
      await page.locator('.kapsapp-bottom-nav').waitFor();
      assert.equal(await page.locator('.app-shell').evaluate(e => getComputedStyle(e).position), iosStandalone ? 'relative' : 'fixed');
      const check = async () => {
        const geometry = await page.evaluate(() => {
          const shell = document.querySelector('.app-shell')!;
          const header = document.querySelector('.app-shell > header')!;
          const dock = document.querySelector('.kapsapp-bottom-nav')!;
          const content = document.querySelector('.app-content')!;
          const rect = (e: Element) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, width: r.width }; };
          return { shell: rect(shell), header: rect(header), dock: rect(dock), content: rect(content),
            height: visualViewport!.height, width: innerWidth, scrollHeight: document.documentElement.scrollHeight,
            blur: getComputedStyle(header).backdropFilter, padding: getComputedStyle(content).paddingBottom, y: scrollY };
        });
        assert.ok(Math.abs(geometry.shell.bottom - geometry.height) <= 1, JSON.stringify(geometry));
        assert.ok(Math.abs(geometry.dock.bottom - geometry.shell.bottom) <= 1);
        assert.ok(Math.abs(geometry.content.bottom - geometry.dock.top) <= 1, 'no spacer or overlapping dock');
        assert.equal(geometry.shell.width, geometry.width);
        assert.equal(geometry.blur, 'none');
        assert.equal(geometry.padding, '0px');
        assert.equal(geometry.y, 0);
        assert.ok(geometry.scrollHeight <= geometry.height + 1, 'document must not have a second scrollbar');
      };
      await check();
      if (iosStandalone) {
        // Model WebKit shortening its dynamic viewport after the first paint.
        // The standalone percentage/lvh chain must win over the dvh rule.
        const shortDvh = await page.addStyleTag({ content: '.app-shell.kapsapp-viewport {height:calc(100dvh - 47px)}' });
        await check();
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')));
        await check();
        await shortDvh.evaluate(e => e.remove());
      }
      // iOS may keep stale JS viewport dimensions while CSS 100dvh is full size.
      // This is a measurement simulation, not physical iOS/PWA verification.
      await page.evaluate(() => {
        (window as any).__viewportDescriptors = {
          innerHeight: Object.getOwnPropertyDescriptor(window, 'innerHeight'),
          height: Object.getOwnPropertyDescriptor(visualViewport!, 'height'),
          offsetTop: Object.getOwnPropertyDescriptor(visualViewport!, 'offsetTop'),
        };
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: visualViewport!.height - 44 });
        Object.defineProperty(visualViewport!, 'height', { configurable: true, value: visualViewport!.height - 88 });
        Object.defineProperty(visualViewport!, 'offsetTop', { configurable: true, value: 44 });
        visualViewport!.dispatchEvent(new Event('resize'));
      });
      await page.waitForFunction(() => !document.documentElement.style.getPropertyValue('--app-shell-height'));
      assert.equal(await page.locator('.app-shell').evaluate(e => e.getBoundingClientRect().bottom), size.height);
      assert.equal(await page.locator('.kapsapp-bottom-nav').evaluate(e => e.getBoundingClientRect().bottom), size.height);
      await page.evaluate(() => {
        const saved = (window as any).__viewportDescriptors;
        for (const [target, key] of [[window, 'innerHeight'], [visualViewport!, 'height'], [visualViewport!, 'offsetTop']] as const) {
          if (saved[key]) Object.defineProperty(target, key, saved[key]);
          else delete (target as any)[key];
        }
        delete (window as any).__viewportDescriptors;
        visualViewport!.dispatchEvent(new Event('resize'));
      });
      await check();
      // Scroll the actual dashboard to its end: chrome stays still, final content remains reachable.
      const scroller = page.locator('.app-content > .overflow-y-auto');
      await scroller.evaluate(e => { e.scrollTop = e.scrollHeight; });
      await page.mouse.wheel(0, 1000);
      await check();
      assert.ok(await scroller.evaluate(e => e.scrollTop > 0), 'dashboard remains scrollable');
      await page.setViewportSize({ width: size.width, height: size.height - 80 });
      await page.waitForFunction(() => Math.abs(document.querySelector('.app-shell')!.getBoundingClientRect().height - visualViewport!.height) < 1);
      await check();
      // CSS env() is zero in desktop emulation. Inject the equivalent measured
      // insets to verify they are consumed once, rather than claim notch emulation.
      await page.addStyleTag({ content: '.app-shell > header {height:97px;padding-top:47px}.kapsapp-bottom-nav {padding-bottom:34px}' });
      await check();
      assert.equal(await page.locator('.kapsapp-bottom-nav').evaluate(e => e.getBoundingClientRect().height), 91);
      await page.evaluate(() => { document.documentElement.dataset.keyboardOpen = 'true'; });
      assert.equal(await page.locator('.kapsapp-bottom-nav').isVisible(), false, 'hide the entire dock including safe padding');
      assert.deepEqual(errors, []);
      console.log(`PASS ${size.width}x${size.height} ${mode}: launch, bounds, dock, scroll, resize, insets, keyboard`);
      await context.close();
    }
  }
} finally { await browser?.close(); await vite.close(); }
