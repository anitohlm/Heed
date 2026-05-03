import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
});
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

console.log('Loading page...');
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
console.log('Page loaded:', await page.title());

// Wait for card to appear
await page.waitForSelector('.heed-card', { timeout: 5000 });
const cards = await page.$$('.heed-card');
console.log(`Found ${cards.length} .heed-card elements`);

if (cards.length === 0) {
  console.log('ERROR: No .heed-card found');
  await browser.close();
  process.exit(1);
}

const card = cards[0];
const box = await card.boundingBox();
console.log(`Card bounds: x=${box.x.toFixed(0)}, y=${box.y.toFixed(0)}, w=${box.width.toFixed(0)}, h=${box.height.toFixed(0)}`);

const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;

// ── Test 1: small drag — card should move ───────────────────────
console.log('\n--- Test 1: drag 60px right (below threshold 80) ---');
const before = await card.evaluate(el => el.style.transform);
console.log('transform before drag:', JSON.stringify(before));

await page.evaluate(([x, y]) => {
  const el = document.querySelector('.heed-card');

  el.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, cancelable: true, pointerType: 'touch',
    pointerId: 1, clientX: x, clientY: y, isPrimary: true,
  }));

  for (let i = 1; i <= 6; i++) {
    el.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, pointerType: 'touch',
      pointerId: 1, clientX: x + i * 10, clientY: y, isPrimary: true,
    }));
  }
}, [cx, cy]);

await page.waitForTimeout(100);
const midTransform = await card.evaluate(el => el.style.transform);
console.log('transform during drag:', JSON.stringify(midTransform));

await page.evaluate(([x, y]) => {
  const el = document.querySelector('.heed-card');
  el.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true, cancelable: true, pointerType: 'touch',
    pointerId: 1, clientX: x + 60, clientY: y, isPrimary: true,
  }));
}, [cx, cy]);

await page.waitForTimeout(600);
const afterSmall = await card.evaluate(el => el.style.transform);
console.log('transform after small drag (expect snap-back):', JSON.stringify(afterSmall));

// ── Test 2: big drag — should fly off ───────────────────────────
console.log('\n--- Test 2: drag 120px right (over threshold 80) ---');
const cards2 = await page.$$('.heed-card');
if (cards2.length === 0) {
  console.log('No cards left — previous swipe may have triggered fly-off');
} else {
  const card2 = cards2[0];
  const box2 = await card2.boundingBox();
  const cx2 = box2.x + box2.width / 2;
  const cy2 = box2.y + box2.height / 2;

  await page.evaluate(([x, y]) => {
    const el = document.querySelector('.heed-card');
    el.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerType: 'touch',
      pointerId: 2, clientX: x, clientY: y, isPrimary: true,
    }));
    for (let i = 1; i <= 12; i++) {
      el.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, cancelable: true, pointerType: 'touch',
        pointerId: 2, clientX: x + i * 10, clientY: y, isPrimary: true,
      }));
    }
    el.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, pointerType: 'touch',
      pointerId: 2, clientX: x + 120, clientY: y, isPrimary: true,
    }));
  }, [cx2, cy2]);

  await page.waitForTimeout(150);
  const flyTransform = await card2.evaluate(el => el.style.transform);
  console.log('transform during fly-off:', JSON.stringify(flyTransform));
  await page.waitForTimeout(400);

  const cards3 = await page.$$('.heed-card');
  console.log(`Cards after fly-off: ${cards3.length} (expect 1 = next card, or 0 if only 1 card)`);
}

// ── Test 3: badge visibility ─────────────────────────────────────
console.log('\n--- Test 3: badge opacity during drag ---');
const freshCards = await page.$$('.heed-card');
if (freshCards.length > 0) {
  const fc = freshCards[0];
  const fb = await fc.boundingBox();
  const fcx = fb.x + fb.width / 2;
  const fcy = fb.y + fb.height / 2;

  await page.evaluate(([x, y]) => {
    const el = document.querySelector('.heed-card');
    el.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerType: 'touch',
      pointerId: 3, clientX: x, clientY: y, isPrimary: true,
    }));
    for (let i = 1; i <= 10; i++) {
      el.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, cancelable: true, pointerType: 'touch',
        pointerId: 3, clientX: x + i * 10, clientY: y, isPrimary: true,
      }));
    }
  }, [fcx, fcy]);

  await page.waitForTimeout(50);

  const badgeOpacities = await page.evaluate(() => {
    const done = document.querySelector('[data-badge="done"]');
    const skip = document.querySelector('[data-badge="skip"]');
    return {
      done: done ? done.style.opacity : 'not found',
      skip: skip ? skip.style.opacity : 'not found',
    };
  });
  console.log('Badge opacities during right drag:', badgeOpacities);

  await page.evaluate(([x, y]) => {
    const el = document.querySelector('.heed-card');
    el.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, pointerType: 'touch',
      pointerId: 3, clientX: x + 100, clientY: y, isPrimary: true,
    }));
  }, [fcx, fcy]);
}

// ── Summary ───────────────────────────────────────────────────
console.log('\n--- Results ---');
if (errors.length) {
  console.log('JS errors:', errors);
} else {
  console.log('No JS errors');
}

const dragged = midTransform && midTransform !== '' && midTransform !== 'none';
console.log('Drag test:', dragged ? 'PASS — card moved' : 'FAIL — card did not move');

await browser.close();
