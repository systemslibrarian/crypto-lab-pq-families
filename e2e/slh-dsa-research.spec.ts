import { test, expect } from '@playwright/test';

test('SHA-2 research separates conditional stages from chained recovery', async ({ page }) => {
  await page.goto('./#family=hash');
  await page.locator('[data-view="attacks"]').click();
  const note = page.locator('.attack-item').filter({ hasText: 'Chang et al.' });
  await expect(note).toBeVisible();
  for (const text of ['20 November 2026', 'preprint', 'conditional stage-wise', 'full seed', 'three seeds, three signatures each', 'not continuous signing traces', 'remain unvalidated', 'not a mathematical break']) {
    await expect(note).toContainText(text);
  }
  await page.locator('[data-view="sources"]').click();
  await expect(page.locator('.ref-list a[href="https://eprint.iacr.org/2026/2753"]')).toBeVisible();
});
