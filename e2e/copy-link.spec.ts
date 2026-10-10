import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

for (const width of [1440, 1280, 1024, 768, 390, 320]) {
  test(`Copy Link does not cover hero text at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./#family=lattice');
    await page.evaluate(() => document.fonts.ready);
    const copy = page.getByRole('button', { name: 'Copy link to this view' });
    await expect(copy).toBeVisible();

    const layout = await copy.evaluate((button) => {
      const action = button.getBoundingClientRect();
      const overlapping = [...document.querySelectorAll(
        '.cl-hero-title, .cl-hero-sub, .cl-hero-desc, .cl-hero-why-label, .cl-hero-why-text',
      )].filter((text) => {
        const r = text.getBoundingClientRect();
        return Math.min(action.right, r.right) - Math.max(action.left, r.left) > 1 &&
          Math.min(action.bottom, r.bottom) - Math.max(action.top, r.top) > 1;
      }).map((text) => text.className);
      return {
        overlapping,
        insideViewport: action.left >= 0 && action.right <= window.innerWidth,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(layout.overlapping, 'the control must not obscure learner-facing text').toEqual([]);
    expect(layout.insideViewport).toBe(true);
    expect(layout.overflow).toBe(false);
  });
}

test('Copy Link keeps the current family deep link and supports keyboard activation', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./#family=lattice');
  const copy = page.getByRole('button', { name: 'Copy link to this view' });
  await copy.focus();
  await page.keyboard.press('Enter');
  await expect(copy).toContainText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());

  await page.locator('#family-tab-code').click();
  await expect(page).toHaveURL(/family=code/);
  await copy.click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  await expect(copy).toContainText('Copy link');
});

test('clipboard denial shows failure and restores the usable control', async ({ page }) => {
  await page.goto('./#family=lattice');
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: async () => { throw new DOMException('Clipboard denied', 'NotAllowedError'); },
    });
  });
  const copy = page.getByRole('button', { name: 'Copy link to this view' });
  await copy.click();
  await expect(copy).toContainText('Copy failed');
  await expect(copy).not.toHaveClass(/is-copied/);
  await expect(copy).toContainText('Copy link');
  await expect(copy).toBeEnabled();
});
