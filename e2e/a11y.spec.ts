import { expect, test } from '@playwright/test';
import {
  boot,
  driveAllStates,
  expectBaselineNotStale,
  NARROW,
  reportCollected,
  watchPageErrors,
} from './gate';

/**
 * WCAG A/AA regression gate.
 *
 * The lab is driven along everything it teaches: the arrival state, with three
 * panels hidden and four Lamport controls locked; both skip links focused; all
 * three audience modes, which fade every non-headline section to `opacity: 0.55`
 * and which the gate this replaces never selected; all five families and, on a
 * broken one, all four subview panes — including Math, whose rows reach their
 * visible state only through an animation; the pin drawer filled and emptied;
 * every recommender need and priority; all five handshake presets including the
 * broken combination that raises `#hs-broken`, hybrid off and on, both extra
 * certificate chain depths and the largest KEM and signature on the page; the
 * Lamport lab from locked controls through keygen, sign, verify, tamper, the
 * two-signature key-reuse leak and the toy-width forgery at all three widths;
 * every lattice basis, one reduction step, the fixed point and a focused SVG
 * handle; all three ISD parameter sets and both slider extremes; all three size
 * metrics; all five context tabs; both disclosures; and the copy-link flash.
 * Every one of those states is scanned, in both themes, at desktop and phone
 * width.
 *
 * See `gate.ts` for why nothing is injected into the page (this lab's
 * reduced-motion handling is three separate blocks and one of them is the only
 * reason twelve of its thirteen sections are visible at all), why no panel is
 * force-revealed, why no button is clicked by regex, why the lab's defaults are
 * asserted rather than assumed, and why `violations` is not the whole oracle.
 */

for (const theme of ['dark', 'light'] as const) {
  test(`no WCAG A/AA violations in ${theme} theme`, async ({ page, context }) => {
    test.setTimeout(1_800_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = watchPageErrors(page);
    await boot(page, theme);
    await driveAllStates(page, theme);
    expectBaselineNotStale();
    expect(errors, errors.join('\n')).toEqual([]);
    reportCollected();
  });

  test(`no WCAG A/AA violations in ${theme} theme at 380px`, async ({ page, context }) => {
    test.setTimeout(1_800_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = watchPageErrors(page);
    await page.setViewportSize(NARROW);
    await boot(page, theme);
    await driveAllStates(page, `${theme} @380px`);
    expectBaselineNotStale();
    expect(errors, errors.join('\n')).toEqual([]);
    reportCollected();
  });
}
