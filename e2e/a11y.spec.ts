import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * WCAG regression gate. Scans the full page with every collapsible expanded,
 * every tab panel revealed, and the live demos driven, in both themes.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function revealEverything(page: Page): Promise<void> {
  // Neutralize animations/transitions/opacity so nothing is mid-flight or dimmed.
  await page.addStyleTag({
    content: `*,*::before,*::after{transition:none!important;animation:none!important}`,
  });

  // Open every <details>.
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => {
      (d as HTMLDetailsElement).open = true;
    });
  });

  // Reveal every tab panel and class-toggled panel; unhide anything hidden.
  await page.evaluate(() => {
    document
      .querySelectorAll('[hidden], .tab-panel, [role="tabpanel"], .panel, .accordion-panel')
      .forEach((el) => {
        el.removeAttribute('hidden');
        (el as HTMLElement).style.display = '';
        (el as HTMLElement).classList.add('is-active', 'active', 'open');
        (el as HTMLElement).classList.remove('is-hidden');
      });
  });

  // Drive live demos: dispatch a click on any run/generate/attack/step button
  // so dynamically injected result regions get rendered and scanned. Done fully
  // in-page (no per-element round trips) to stay fast and DOM-stable.
  await page.evaluate(() => {
    const run =
      /run|gen|sign|attack|step|start|compute|solve|search|encrypt|next|play|reset|calc/i;
    const skip = /theme|toggle|copy|github|menu|skip/i;
    document.querySelectorAll('button').forEach((btn) => {
      const label = (btn.getAttribute('aria-label') ?? btn.textContent ?? '').trim();
      if (skip.test(label)) return;
      if (run.test(label)) {
        try {
          btn.click();
        } catch {
          /* ignore */
        }
      }
    });
  });

  // Re-open details / re-reveal after any demo re-render.
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => {
      (d as HTMLDetailsElement).open = true;
    });
    document.querySelectorAll('[hidden]').forEach((el) => el.removeAttribute('hidden'));
  });
  await page.waitForTimeout(200);
}

async function scan(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
  }));
  expect(summary).toEqual([]);
}

test('no WCAG A/AA violations in dark theme', async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#app')).toBeVisible();
  await revealEverything(page);
  await scan(page);
});

test('no WCAG A/AA violations in light theme', async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#app')).toBeVisible();
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await revealEverything(page);
  await scan(page);
});
