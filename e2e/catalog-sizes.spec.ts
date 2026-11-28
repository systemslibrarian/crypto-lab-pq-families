import { expect, test } from '@playwright/test';

test('the Classic McEliece public key uses binary units', async ({ page }) => {
  await page.goto('.');
  await page.locator('#family-tab-code').click();
  const card = page.locator('#family-detail .panel-card--scheme[data-scheme="Classic McEliece 348864"]');
  await expect(card).toContainText('255 KiB');
});

test('the classical baseline counts raw components separately from TLS encoding', async ({ page }) => {
  await page.goto('.');
  const calculator = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Handshake Bytes', exact: true }) });
  await calculator.getByText('How the segments break down').click();
  await expect(calculator).toContainText('256 raw bytes');
  await expect(calculator).toContainText('DER-encoded ECDSA signatures');
  await calculator.locator('.hs-chain-buttons').getByRole('radio').first().click();
  await expect(calculator.locator('#hs-note')).toContainText('256 B');
});
