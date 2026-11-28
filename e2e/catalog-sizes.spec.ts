import { expect, test } from '@playwright/test';

test('the Classic McEliece public key uses binary units', async ({ page }) => {
  await page.goto('.');
  await page.locator('#family-tab-code').click();
  const card = page.locator('#family-detail .panel-card--scheme[data-scheme="Classic McEliece 348864"]');
  await expect(card).toContainText('255 KiB');
});
