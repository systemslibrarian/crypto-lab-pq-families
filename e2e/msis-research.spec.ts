import { test, expect } from '@playwright/test';

test('lattice comparison separates research estimates from standard categories', async ({ page }) => {
  await page.goto('./#family=lattice');
  await page.locator('[data-view="attacks"]').click();
  const note = page.locator('.attack-item').filter({ hasText: 'Refined MSIS security estimates' });
  await expect(note).toBeVisible();
  await expect(note).toContainText('16 October 2026');
  await expect(note).toContainText('model-dependent extrapolation');
  await expect(note).toContainText('not demonstrated production-key recovery');
  await expect(note).toContainText('does not revise FIPS 204 categories');
  await page.locator('[data-view="sources"]').click();
  await expect(page.locator('.ref-list a[href="https://eprint.iacr.org/2026/607"]')).toBeVisible();
  await page.locator('[data-view="overview"]').click();
  await expect(page.locator('body')).toContainText('ML-DSA-65');
});
