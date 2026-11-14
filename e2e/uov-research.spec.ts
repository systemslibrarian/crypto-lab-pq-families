import { test, expect } from '@playwright/test';

test('multivariate research stays conditional and links its primary source', async ({ page }) => {
  await page.goto('./#family=multivariate');
  await page.locator('[data-view="attacks"]').click();
  const note = page.locator('.attack-item').filter({ hasText: 'Li–Tao:' });
  await expect(note).toBeVisible();
  for (const text of ['14 November 2026', 'preprint', 'conjectural Hilbert-series', 'not demonstrated production-key recovery', 'older ov-Ip', 'does not execute']) {
    await expect(note).toContainText(text);
  }
  await page.locator('[data-view="sources"]').click();
  await expect(page.locator('.ref-list a[href="https://eprint.iacr.org/2026/2272"]')).toBeVisible();
});
