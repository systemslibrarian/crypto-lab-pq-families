import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [1280, 380]) {
  test(`source-account comparison stays readable and separate at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('.');
    await page.locator('#info-tab-shor').click();
    const comparison = page.locator('#quantum-resource-comparison');
    await expect(comparison).toBeVisible();
    await expect(comparison.locator('[data-estimate="gidney-ekera-2019"]')).toHaveText('Approximately 20 million noisy qubits');
    await expect(comparison.locator('[data-estimate="gidney-2025"]')).toHaveText('897,864 before slack; approximately one million with safety slack');
    const logicalRow = comparison.locator('tr').filter({ hasText: 'Logical accounting' });
    await expect(logicalRow.locator('td').nth(0)).not.toContainText('1,409');
    await expect(logicalRow.locator('td').nth(1)).toContainText('1,409 active logical qubits; 1,537 including idle hot patches');
    await expect(comparison).toContainText('0.1% gate error, 1 μs surface-code cycles and 10 μs');
    await expect(comparison).toContainText('not hardware demonstrations');
    await expect(comparison.locator('a[href="https://arxiv.org/abs/2505.15917v1"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const scan = await new AxeBuilder({ page }).include('#quantum-resource-comparison').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    expect(scan.violations).toEqual([]);
  });
}
