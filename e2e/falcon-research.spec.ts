import { test, expect } from '@playwright/test';

test('Falcon research distinguishes physical key expansion from a lattice break', async ({ page }) => {
  await page.goto('./#family=lattice');
  await page.locator('[data-view="attacks"]').click();
  const note = page.locator('.attack-item').filter({ hasText: 'Falcon single-trace key-expansion leakage' });
  await expect(note).toBeVisible();
  for (const text of ['16 November 2026', 'accepted to TCHES 2027', 'one power trace', 'sign_dyn', 'Cortex-M4', '53 of 100', 'ten traces', 'physical power observation', 'not establish a mathematical break', 'does not reproduce']) {
    await expect(note).toContainText(text);
  }
  await page.locator('[data-view="sources"]').click();
  await expect(page.locator('.ref-list a[href="https://eprint.iacr.org/2025/2159"]')).toBeVisible();
});
