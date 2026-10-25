import { test, expect } from '@playwright/test';

test('hash family keeps standardized status while scoping power-analysis evidence', async ({ page }) => {
  await page.goto('./#family=hash');
  await expect(page.locator('#family-detail .family-name')).toContainText('Standardized');
  await page.locator('[data-view=attacks]').click();
  const note = page.locator('.attack-item').filter({ hasText: 'SLH-DSA-SHAKE power analysis' });
  await expect(note).toBeVisible();
  await expect(note).toContainText('preprint; attack-model-conditional');
  await expect(note).toContainText('24 October 2026');
  await expect(note).toContainText('physical power measurements');
  await expect(note).toContainText('does not establish vulnerability of SHA-2 browser implementations');
  await expect(note).toContainText('does not reproduce the experiment');
  await page.locator('[data-view=sources]').click();
  await expect(page.locator('.ref-list a[href="https://eprint.iacr.org/2026/2584"]')).toBeVisible();
});

test('research note preserves evidence and attack-model boundaries', async ({ page }) => {
  await page.goto('./#family=isogeny');
  await page.locator('[data-view=attacks]').click();
  const note = page.locator('.attack-item').filter({ hasText: 'Targeted faults in deterministic CSIDH variants' });
  await expect(note).toBeVisible();
  await expect(note).toContainText('20 October 2026');
  await expect(note).toContainText('preprint');
  await expect(note).toContainText('software fault simulation');
  await expect(note).toContainText('separately');
  await expect(note).toContainText('targeted fault injection');
  await expect(note).toContainText('not complete hardware key recovery');
  await expect(note).toContainText('does not implement the attacked variants');
  await page.locator('[data-view=sources]').click();
  await expect(page.locator('.ref-list a[href="https://eprint.iacr.org/2026/2542"]')).toBeVisible();
});
