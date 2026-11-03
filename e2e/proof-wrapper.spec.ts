import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [1280, 380]) {
  for (const theme of ['dark']) {
    test(`proof dependencies remain explicit at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('./');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const section = page.locator('#section-proof-wrapper');
      await section.scrollIntoViewIfNeeded();
      await expect(section.getByText('Classical proof dependency remains', { exact: true })).toBeVisible();
      await expect(section).toContainText('certificate chain and trust anchor');
      await page.getByLabel('Compare a design change').selectOption('proof');
      await expect(page.locator('#proof-result')).toContainText('still requires review');
      await page.getByLabel('Compare a design change').selectOption('parallel');
      await expect(page.locator('#proof-result')).toContainText('require BOTH signatures');
      await expect(page.locator('#proof-result')).toContainText('Accepting EITHER signature instead');
      const report = await new AxeBuilder({ page }).include('#section-proof-wrapper').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(report.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByLabel('Compare a design change').selectOption('signature');
      await expect(page.locator('#proof-result')).toContainText('has not become post-quantum');
    });
  }
}
