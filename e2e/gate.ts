import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';
import { auditContrast, formatContrastFailures } from './contrast';
import { auditNonText } from './nontext';
import { NONTEXT_BASELINE } from './nontext-baseline';

export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A phone-width viewport, for the WCAG 1.4.10 reflow half of the gate. */
export const NARROW = { width: 380, height: 800 };

/**
 * Shared machinery for the WCAG gate.
 *
 * Six rules govern everything here, and every one of them corrects something
 * `revealEverything()` — the whole of the gate this replaces — did:
 *
 *  1. NOTHING IS INJECTED INTO THE PAGE BEFORE A SCAN. It pushed
 *     `transition:none!important; animation:none!important` through
 *     `addStyleTag`, BYPASSING this lab's own reduced-motion handling instead of
 *     exercising it. That handling is not decorative here and it is not one
 *     block but three: `style.css` clamps every duration, `extra.css` restores
 *     `.reveal-pending { opacity: 1 }` — the class `wireScrollReveals()` puts on
 *     ALL THIRTEEN sections, whose only other route to visibility is an
 *     IntersectionObserver — and a third block cancels the audience-mode
 *     transition. An injected `animation:none` reproduces none of that, and on
 *     the one rule that matters most it does the opposite: `.math-row` ships
 *     `opacity: 0` and reaches `opacity: 1` ONLY through
 *     `animation: row-enter … forwards`, so a blanket `animation: none` leaves
 *     every row of the Math subview permanently invisible while reporting green.
 *     `boot` asks for the preference and ASSERTS it took effect; `expectNotBlank`
 *     re-measures the outcome at every driven state.
 *
 *  2. IT FORCE-REVEALED EVERYTHING, ASSEMBLING A DOCUMENT NO VISITOR CAN LOAD.
 *     It stripped `hidden` from every element, cleared inline `display`, and
 *     added `is-active active open` to every `[hidden], .tab-panel,
 *     [role=tabpanel], .panel, .accordion-panel`. On this page that means all
 *     four family subview panels open at once (Overview, Math, Attacks and
 *     Sources stacked), the `.pinned-drawer` shown with nothing pinned, the
 *     `#broken-banner` shown while a non-broken family is selected, and
 *     `#hs-broken` — "these bytes are from a scheme that no longer exists as a
 *     security claim" — shown next to a handshake built entirely from live
 *     schemes. This gate never touches `hidden`, `display` or `open`; every
 *     panel is reached through the control that reveals it.
 *
 *  3. IT CLICKED EVERY BUTTON WHOSE LABEL MATCHED A REGEX, IN ONE SYNCHRONOUS
 *     `page.evaluate`. `/run|gen|sign|attack|step|start|compute|solve|search|
 *     encrypt|next|play|reset|calc/i` against 73 buttons, in DOM order, with no
 *     wait between them and no assertion that any of them did anything. It fired
 *     `#lamport-sign` while it was still `disabled` (a no-op), reached
 *     `#lamport-gen` only because "gen" matched, and hit the "Attacks" subview
 *     tab and the "Lagrange–Gauss: one step" preset as side effects of the same
 *     regex. Whatever state that produced was not a state anyone chose. Here
 *     every control is named, its precondition asserted, and its effect asserted
 *     before the next step.
 *
 *  4. IT SCANNED ONCE, AT ONE VIEWPORT, AFTER THE WHOLE THING, and it waited on
 *     `page.waitForTimeout(200)` to decide the page had settled. Every state it
 *     built was overwritten before anything measured it, and 380px was never
 *     scanned. This drive scans after every step, in {dark, light} × {1280, 380},
 *     and waits on real completion signals.
 *
 *  5. `violations` IS NOT THE WHOLE ORACLE. See `scan`. Twenty `color-contrast`
 *     results land in axe's `incomplete` bucket on first paint here, including
 *     the `<h1>`, because this palette is `color-mix(in oklab, …)` throughout.
 *
 *  6. IT HAD NO REFLOW, KEYBOARD-SCROLLER OR NON-TEXT-CONTRAST ORACLE, and this
 *     page needs all three: a horizontally scrolling comparison table, a
 *     horizontally scrolling sticky nav, an SVG figure with two `role="button"`
 *     handles, and dozens of chip-shaped controls.
 */

/**
 * Wait for every running animation and transition to drain.
 *
 * Transitions drain in waves, not in one batch, so a poll for "nothing running
 * right now" can exit through a gap between waves. Require quiescence to hold
 * for several consecutive frames instead. This page needs it: the handshake
 * segments animate their width over 700ms, the Lamport grid staggers 256 cells
 * at 2ms each, and the audience filter cross-fades whole sections.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __quietFrames?: number };
      const running = document.getAnimations().filter((a) => a.playState === 'running');
      w.__quietFrames = running.length === 0 ? (w.__quietFrames ?? 0) + 1 : 0;
      return w.__quietFrames >= 6;
    },
    undefined,
    { timeout: 20_000, polling: 'raf' }
  );
}

/**
 * Assert that reduced motion left the page visible, not merely un-animated.
 *
 * The failure mode this guards against is an element whose only route to its
 * visible state is an animation, in a stylesheet whose reduced-motion block
 * cancels that animation without restoring its end state — the element then
 * renders at `opacity: 0` for every reader with the preference set.
 *
 * This page has TWO elements in exactly that shape, which is why the check runs
 * at every state rather than once. `.lab-section.reveal-pending` ships
 * `opacity: 0` and is brought up by an IntersectionObserver; `extra.css`
 * restores it to 1 under reduced motion, so it is safe — but only because that
 * override exists, and it is one line. `.math-row` ships `opacity: 0` with
 * `animation: row-enter 420ms ease forwards` and NO reduced-motion override at
 * all; it survives because the blanket rule clamps the duration to 0.001ms
 * rather than setting `animation: none`, and `forwards` then holds the end
 * state. Change that clamp to `animation: none` — the more common spelling —
 * and every row of the Math subview goes blank. This assertion is what makes
 * that a measurement instead of a reading.
 *
 * `aria-hidden` subtrees are excluded; see the header of `contrast.ts` for the
 * enumeration of what this lab hides and why none of it carries a value.
 */
async function expectNotBlank(page: Page, label: string): Promise<void> {
  const invisible = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      // Deliberately hidden subtrees are not "blank", they are closed.
      if (!(el as HTMLElement).checkVisibility?.({ checkVisibilityCSS: true })) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      let effective = 1;
      let node: Element | null = el;
      while (node) {
        effective *= parseFloat(getComputedStyle(node).opacity);
        node = node.parentElement;
      }
      if (effective === 0) {
        out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}`);
      }
    }
    return Array.from(new Set(out));
  });
  expect(invisible, `no visible text may render at opacity 0 in state: ${label}`).toEqual([]);
}

/**
 * Uncaught page errors and console errors, collected from the moment the page
 * is created. A renderer that throws halfway through leaves an earlier state on
 * screen, and a gate that scans that state reports green for a page that is
 * broken. Attach before `boot`, assert after the drive.
 */
export function watchPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

/**
 * Exactly one banner landmark: the shared bar.
 *
 * `index.html`'s `dedupeBanner()` demotes any other implicit banner, and on this
 * page it has something to do: `mountApp` renders the hero inside `#app`, a
 * plain `<div>`, so `closest('main, article, aside, nav, section')` finds
 * nothing to scope it out. Asserting the OUTCOME rather than either mechanism
 * means a change to the nesting is caught too.
 */
export async function assertSingleBanner(page: Page): Promise<void> {
  const banners = await page.evaluate(() => {
    const scoped = new Set(['MAIN', 'ARTICLE', 'ASIDE', 'NAV', 'SECTION']);
    const isBanner = (el: Element): boolean => {
      if (el.getAttribute('role') === 'banner') return true;
      if (el.tagName !== 'HEADER') return false;
      if (el.getAttribute('role')) return false; // explicit non-banner role wins
      for (let p = el.parentElement; p; p = p.parentElement) if (scoped.has(p.tagName)) return false;
      return true;
    };
    return [...document.querySelectorAll('header,[role="banner"]')].filter(isBanner).length;
  });
  expect(banners, 'exactly one banner landmark').toBe(1);
}

/** The thirteen sections `mountApp` builds, in document order. */
export const SECTIONS = [
  'section-families',
  'section-recommend',
  'section-handshake',
  'section-lamport',
  'section-lattice',
  'section-isd',
  'section-sizes',
  'section-compare',
  'section-impl',
  'section-timeline',
  'section-context',
  'section-glossary',
  'section-remember',
] as const;

/** The four Lamport controls that ship DISABLED until a keypair exists. */
export const LOCKED_CONTROLS = [
  '#lamport-sign',
  '#lamport-verify',
  '#lamport-tamper',
  '#lamport-sign2',
] as const;

/** The three panels that ship `hidden` and each need a specific state to appear. */
export const HIDDEN_PANELS = [
  '.pinned-drawer',
  '#broken-banner',
  '#hs-broken',
] as const;

/**
 * Load the page in a known theme with reduced motion actually in effect, and
 * assert the content every scan relies on is really on the page — including the
 * lab's DEFAULTS, which are never assumed.
 *
 * `test.use({ reducedMotion })` silently does nothing on Playwright 1.61.1, so
 * the emulation is applied imperatively BEFORE the navigation and then
 * *asserted* from inside the page. Without it this page is not merely animated
 * but largely INVISIBLE: `wireScrollReveals()` puts `.reveal-pending`
 * (`opacity: 0`) on all thirteen sections and only an IntersectionObserver takes
 * it off, so a scan of the un-scrolled document would measure a page that is
 * one hero and twelve blank rectangles.
 *
 * The theme is seeded through `localStorage` rather than by clicking a toggle,
 * which also pins down a real failure mode: `index.html`'s anti-flash script
 * reads `localStorage.getItem('theme')`, the shared bar's `#cl-theme-toggle`
 * writes it, and this lab's own `#theme-toggle` in `main.ts` writes it again. If
 * any of the three drifted apart the theme would silently stop persisting, and
 * this boot fails on `data-theme` rather than quietly scanning dark twice.
 *
 * The defaults are asserted at length because five separate exhibits here ship
 * in a chosen state that a single-configuration gate would scan as if it were
 * the only one: one of five family tabs, one of four subview tabs, one of three
 * size metrics, one of five context tabs, a KEM and a signature already picked
 * in the handshake calculator with hybrid ON, and an audience filter set to
 * "All" — which is the one value that leaves the `opacity: 0.55` section fade
 * switched off.
 */
export async function boot(page: Page, theme: 'dark' | 'light'): Promise<void> {
  // A click on a control that never becomes actionable otherwise burns the whole
  // test timeout and reports nothing useful. 20s turns that silent hang into a
  // named failure naming the locator.
  page.setDefaultTimeout(20_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
  await page.goto('.');
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'reduced-motion emulation must actually be in effect'
  ).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await assertSingleBanner(page);

  // `mountApp` builds the entire document; a navigation that resolves proves
  // nothing.
  for (const id of SECTIONS) await expect(page.locator(`#${id}`)).toBeVisible();
  // Fourteen, not thirteen: the <footer> carries `.lab-section` too, and it is
  // therefore also `.reveal-pending` — so it is subject to the same
  // reduced-motion override and the same audience fade as the sections above it.
  await expect(page.locator('.lab-section')).toHaveCount(SECTIONS.length + 1);
  await expect(page.locator('footer.lab-section')).toHaveCount(1);

  // The reduced-motion override that makes those thirteen sections visible at
  // all, asserted rather than assumed. `.reveal-pending` is still on every one
  // of them — the observer has not fired for anything below the fold — and the
  // ONLY reason they paint is `extra.css`'s reduced-motion block.
  expect(
    await page.evaluate(() =>
      Array.from(document.querySelectorAll('.lab-section.reveal-pending')).filter(
        (s) => getComputedStyle(s).opacity !== '1'
      ).length
    ),
    'reduced motion must restore .reveal-pending to opacity 1, not merely stop its transition'
  ).toBe(0);

  // ── Everything that ships hidden or locked ───────────────────────────────
  for (const sel of HIDDEN_PANELS) await expect(page.locator(sel)).toBeHidden();
  for (const sel of LOCKED_CONTROLS) await expect(page.locator(sel)).toBeDisabled();
  await expect(page.locator('#lamport-gen')).toBeEnabled();
  await expect(page.locator('details')).toHaveCount(2);
  await expect(page.locator('details[open]')).toHaveCount(0);

  // ── Every shipped default of every fork on the page ──────────────────────
  await expect(page.locator('[data-audience-btn="all"]')).toHaveAttribute('aria-pressed', 'true');
  expect(
    await page.evaluate(() => document.documentElement.getAttribute('data-audience')),
    'the audience filter ships at "all", which is the one value that leaves the 0.55 section fade off'
  ).toBe('all');

  await expect(page.locator('#family-tab-lattice')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(4);
  await expect(page.locator('.subview-tab[data-view="overview"]')).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.locator('.subview-panel')).toHaveCount(4);
  await expect(page.locator('.subview-panel:not([hidden])')).toHaveCount(1);
  await expect(page.locator('#metric-tab-pubKey')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#info-tab-shor')).toHaveAttribute('aria-selected', 'true');

  await expect(page.locator('.pin-btn[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('.rec-chip[data-id="both"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.rec-chip[data-id="primary"]')).toHaveAttribute(
    'aria-checked',
    'true'
  );
  await expect(page.locator('#rec-result')).not.toBeEmpty();

  // The hybrid hedge ships OFF. This assertion is the reason that is known
  // rather than assumed: the checkbox reports `value="on"` — the HTML default
  // for a checkbox with no `value` — and reading that as "checked" is exactly
  // how a gate ends up scanning one half of a fork forever.
  await expect(page.locator('#hs-hybrid')).not.toBeChecked();
  await expect(page.locator('.hs-chain-btn[data-depth="0"]')).toHaveAttribute(
    'aria-checked',
    'true'
  );
  await expect(page.locator('.hs-chip[data-name="ML-KEM-768 (Kyber)"]')).toHaveAttribute(
    'aria-checked',
    'true'
  );
  await expect(page.locator('.hs-chip[data-name="ML-DSA-65 (Dilithium)"]')).toHaveAttribute(
    'aria-checked',
    'true'
  );
  await expect(page.locator('#hs-stack .hs-row')).toHaveCount(2);

  await expect(page.locator('#lamport-msg')).toHaveValue('Hello, post-quantum world!');
  await expect(page.locator('#lamport-msg2')).toHaveValue('Pay Mallory 1000000');
  await expect(page.locator('#lamport-priv')).toHaveText('— · click "Generate" to start');
  await expect(page.locator('#lamport-grid .lc')).toHaveCount(256);
  await expect(page.locator('#lamport-grid-summary')).toHaveText(
    'No signature yet — nothing revealed.'
  );
  await expect(page.locator('[data-forge-bits="12"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#forge-verdict')).toHaveText('—');

  await expect(page.locator('#lat-trace-empty')).toBeVisible();
  await expect(page.locator('#lat-steps li')).toHaveCount(0);
  await expect(page.locator('#lat-verdict')).not.toBeEmpty();

  await expect(page.locator('#isd-n')).toHaveValue('3476');
  await expect(page.locator('#isd-k')).toHaveValue('2728');
  await expect(page.locator('#isd-t')).toHaveValue('64');

  // `[hidden]` has specificity (0,1,0) — identical to a class — so any later
  // `.foo { display: … }` beats it and the attribute silently does nothing.
  // Seven labs in this fleet had exactly that. Measured here rather than
  // inferred from the CSS, because three separate warning panels on this page
  // depend on `hidden` being the thing that keeps them off screen.
  expect(
    await page.evaluate(() => {
      const el = document.querySelector('.lab-section p');
      if (!el) return 'no probe element';
      el.setAttribute('hidden', '');
      const d = getComputedStyle(el).display;
      el.removeAttribute('hidden');
      return d;
    }),
    'the [hidden] attribute must actually hide — no later class may out-rank it'
  ).toBe('none');

  await settle(page);
  await expectNotBlank(page, `${theme} first paint`);
}

/**
 * Assert the page does not require horizontal scrolling.
 *
 * WCAG 1.4.10 (Reflow, AA). axe has no rule for this at all, and this page is
 * full of the shapes that break it: a comparison table with a column per
 * scheme, a sticky nav with thirteen links, a 256-cell grid, an eight-column
 * implementation matrix and a `viewBox`-scaled SVG. Each wide thing is meant to
 * scroll inside its own container; the assertion here is that none of them
 * scrolls the DOCUMENT.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth) return null;

    // Only elements that actually push the DOCUMENT sideways are culprits. A
    // wide box inside an `overflow-x: auto` wrapper has a huge bounding rect but
    // is clipped by its scroller and contributes nothing to the document's
    // scroll width — naming it sends you off fixing the wrong element. This page
    // has a decoy behind `.table-shell` and another behind `.sticky-nav-inner`.
    const clipped = (el: Element): boolean => {
      let n = el.parentElement;
      while (n && n !== doc) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
        n = n.parentElement;
      }
      return false;
    };

    const over = Array.from(document.querySelectorAll('body *'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.right > doc.clientWidth + 1)
      .sort((a, b) => b.r.right - a.r.right);
    const widest = over.filter((x) => !clipped(x.el))[0] ?? over[0];
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      widest: widest
        ? `${clipped(widest.el) ? '[clipped] ' : ''}${widest.el.tagName.toLowerCase()}${widest.el.id ? '#' + widest.el.id : ''}` +
          `${widest.el.getAttribute('class') ? '.' + widest.el.getAttribute('class')!.trim().split(/\s+/).join('.') : ''}` +
          ` @${Math.round(widest.r.width)}px right=${Math.round(widest.r.right)}`
        : '(none identified)',
    };
  });
  expect(overflow, `page must not scroll horizontally in state: ${label}`).toBeNull();
}

/**
 * Every scrolling container must be operable from the keyboard (WCAG 2.1.1). If
 * it holds no focusable content it needs `tabindex="0"`, so it becomes a focus
 * target arrow keys can then scroll.
 *
 * Two of this page's scrollers are already fine for opposite reasons:
 * `.sticky-nav-inner` is full of links, so it is reachable by its content, and
 * `.family-detail` carries an explicit `tabindex="0"`. `.table-shell` is the
 * one to watch — it wraps the widest table on the page and holds no focusable
 * content of its own — and whether it overflows at all depends on the viewport
 * and on which size metric is selected, which is why this runs in every state at
 * both widths rather than being reasoned about once.
 */
export async function expectScrollersReachable(page: Page, label: string): Promise<void> {
  const unreachable = await page.evaluate(() => {
    const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (
          ['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)
        );
      })
      .filter((el) => el.tabIndex < 0 && !el.querySelector(FOCUSABLE))
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}` +
          ` (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`
      );
  });
  expect(
    Array.from(new Set(unreachable)),
    `scrolling regions with no keyboard route in state: ${label}`
  ).toEqual([]);
}

/**
 * When `A11Y_COLLECT` is set, `scan` records failures instead of throwing.
 *
 * A strict gate reports the first failing assertion in the first failing state
 * and stops, so a page with defects in several states needs one full run per
 * defect to enumerate them. The collection pass turns that into a single run. It
 * is a debugging aid only: `A11Y_COLLECT` is never set in CI or in the committed
 * workflow, and a run with it set prints every finding as it happens and then
 * fails at the end, so a green collection run cannot be mistaken for a green
 * gate.
 */
const COLLECTING = !!process.env.A11Y_COLLECT;
const collected: string[] = [];

function record(entry: string): void {
  collected.push(entry);
  // Printed as it happens, not only at the end: a hard assertion later in the
  // drive would otherwise abort the test before anything collected so far was
  // ever shown.
  console.log(`\n[A11Y_COLLECT #${collected.length}] ${entry}`);
}

export function softExpect(actual: unknown, message: string, expected: unknown): void {
  if (!COLLECTING) {
    expect(actual, message).toEqual(expected);
    return;
  }
  try {
    expect(actual, message).toEqual(expected);
  } catch {
    record(`${message}\n  ${JSON.stringify(actual, null, 2)}`);
  }
}

/**
 * Fail the test if the collection pass recorded anything. Without this a
 * collection run would end green, and a green collection run is
 * indistinguishable from a green gate — which is the exact confusion the whole
 * exercise exists to remove.
 */
export function reportCollected(): void {
  if (!COLLECTING) return;
  expect(collected, `A11Y_COLLECT recorded ${collected.length} failure(s)`).toEqual([]);
}

async function expectScrollersReachableSoft(page: Page, label: string): Promise<void> {
  if (!COLLECTING) return expectScrollersReachable(page, label);
  try {
    await expectScrollersReachable(page, label);
  } catch (e) {
    record(String(e).slice(0, 1200));
  }
}

/**
 * The 1.4.11 ratchet, soft-wrapped the same way as every other oracle here.
 *
 * This wrapper is the repair of a dead oracle rather than a refactor. In the
 * reference gate every other lab in this fleet was copied from,
 * `expectNoNewNonTextFailures` was reachable only from inside
 * `expectScrollersReachableSoft`, AFTER that function's
 * `if (!COLLECTING) return …` guard — so in a strict run, which is every run in
 * CI and every run anyone reads as a pass, the guard returned first and
 * `nontext.ts` never executed at all. Thirteen repos carried an empty
 * `nontext-baseline.ts` that was not a clean bill of health but the footprint of
 * a check that had never looked. It is called from `scan()` here.
 */
async function expectNoNewNonTextFailuresSoft(page: Page, label: string): Promise<void> {
  if (!COLLECTING) return expectNoNewNonTextFailures(page, label);
  try {
    await expectNoNewNonTextFailures(page, label);
  } catch (e) {
    record(String(e).slice(0, 2500));
  }
}

async function expectNoHorizontalOverflowSoft(page: Page, label: string): Promise<void> {
  if (!COLLECTING) return expectNoHorizontalOverflow(page, label);
  try {
    await expectNoHorizontalOverflow(page, label);
  } catch (e) {
    record(String(e).slice(0, 1200));
  }
}

/**
 * WCAG 1.4.11 and generated content, ratcheted against a per-repo baseline.
 *
 * Neither class has ANY other oracle: axe has no rule for non-text contrast,
 * and the arithmetic text walk cannot reach a control's boundary or a
 * `::before` glyph, because a pseudo-element is not an element and owns no text
 * node. This page is almost entirely built out of the shape that check exists
 * for — 73 buttons, most of them chips whose only boundary is a 1px `--line`
 * border over a panel of nearly the same colour.
 *
 * The backlog is real, so this does not block on it — but a check that merely
 * logs is not a gate. So it ratchets instead: anything NOT in the baseline
 * fails, anything in the baseline that got WORSE fails, and anything in the
 * baseline that has been FIXED fails until its entry is deleted. That last rule
 * is what stops the allowlist becoming a permanent exemption.
 */
const nonTextSeen = new Set<string>();

export async function expectNoNewNonTextFailures(page: Page, label: string): Promise<void> {
  const found = await auditNonText(page);
  // Capture mode: emit every finding and assert nothing, so a baseline can be
  // generated by the SAME path that checks it. Opt-in via env, and the run is
  // deliberately left failing at the end by `expectBaselineNotStale` so a
  // capture pass can never be mistaken for a passing gate.
  if (process.env.NT_BASELINE_CAPTURE) {
    for (const f of found) {
      console.log(
        `NTCAP|${f.kind}|${f.selector}|${f.ratio}|${f.required}|${/POSITIONED/.test(f.detail)}`
      );
    }
    return;
  }
  const problems: string[] = [];
  for (const f of found) {
    const key = `${f.kind}|${f.selector}`;
    nonTextSeen.add(key);
    const base = NONTEXT_BASELINE[key];
    if (!base) {
      problems.push(
        `NEW ${f.ratio}:1 (needs ${f.required}:1) [${f.kind}] ${f.selector} — ${f.detail}`
      );
    } else if (f.ratio < base.ratio - 0.01) {
      problems.push(`WORSE ${f.selector}: ${f.ratio}:1, baseline recorded ${base.ratio}:1`);
    }
  }
  expect(problems, `new or worsened non-text contrast in state: ${label}`).toEqual([]);
}

/**
 * Fail if a baselined finding never appeared during the whole drive.
 *
 * It has either been fixed — in which case delete the entry, which is the point
 * — or the drive stopped reaching the state that shows it, which is a coverage
 * regression worth knowing about. Call once, after `driveAllStates`.
 */
export function expectBaselineNotStale(): void {
  const unseen = Object.keys(NONTEXT_BASELINE).filter((k) => !nonTextSeen.has(k));
  expect(
    unseen,
    'baselined non-text findings that no longer appear — delete them from nontext-baseline.ts (or restore the drive state that showed them)'
  ).toEqual([]);
}

/**
 * Scan the page as it currently stands.
 *
 * Seven assertions, because axe's `violations` array alone is not a complete
 * oracle:
 *
 *  - reduced-motion end state — see `expectNotBlank`.
 *  - `violations` — the usual WCAG A/AA rule failures, plus four landmark
 *    best-practice rules `withTags` does not run on its own.
 *  - `incomplete` — axe's "could not decide" bucket, which never reaches the
 *    violations array. The one rule id allowed to remain incomplete is
 *    `color-contrast`, and only because the next assertion computes those ratios
 *    arithmetically — which matters more here than in most labs, since twenty
 *    nodes land there on first paint including the `<h1>`. Everything else in
 *    that bucket is a real result axe simply could not finish, including
 *    `aria-prohibited-attr`, which is where an `aria-label` on a role-less
 *    element hides and which never reaches the violations array at all.
 *  - arithmetic contrast — composite-aware WCAG 1.4.3 over every text node.
 *  - non-text contrast and generated content — SC 1.4.11, which axe has no rule
 *    for; see `expectNoNewNonTextFailures`.
 *  - keyboard reachability of scrolling regions — WCAG 2.1.1.
 *  - reflow — WCAG 1.4.10, which axe has no rule for at all.
 */
export async function scan(page: Page, label: string): Promise<void> {
  await settle(page);
  await expectNotBlank(page, label);
  // TWO axe runs, deliberately, and this is not a style choice.
  //
  // `AxeBuilder.withTags()` and `AxeBuilder.withRules()` both write the same
  // `options.runOnly` field, so the second call SILENTLY REPLACES the first —
  // the axe-core/playwright source says so in as many words on `withRules`
  // ("Cannot be used with AxeBuilder#withTags"). Chained as
  // `.withTags(TAGS).withRules([...4 landmark rules])`, axe therefore runs those
  // FOUR best-practice rules and NOT ONE WCAG RULE, while a green result reads
  // exactly like a full A/AA pass. For scale, `withTags(TAGS)` selects 69 of
  // axe-core 4.12's 105 rule definitions; the chained form executes 4.
  //
  // Running the two sets separately and merging is the only way to have both.
  // The landmark four are still wanted because they are best-practice rather
  // than WCAG-tagged, so `withTags` alone does not reach them, and this page has
  // the exact shape they catch: a shared sticky `<header role="banner">` above a
  // hero `<header>` that `dedupeBanner()` has to demote at runtime, with an
  // `<aside role="complementary">` inside that hero.
  const wcag = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const landmarks = await new AxeBuilder({ page })
    .withRules([
      'landmark-no-duplicate-banner',
      'landmark-unique',
      'landmark-one-main',
      'landmark-complementary-is-top-level',
    ])
    .analyze();
  const results = {
    violations: [...wcag.violations, ...landmarks.violations],
    incomplete: [...wcag.incomplete, ...landmarks.incomplete],
  };

  const violations = results.violations.map((v) => ({
    state: label,
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
  }));
  softExpect(violations, `axe violations in state: ${label}`, []);

  const unexplainedIncomplete = results.incomplete
    .filter((v) => v.id !== 'color-contrast')
    .map((v) => ({
      state: label,
      id: v.id,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 20),
    }));
  softExpect(unexplainedIncomplete, `axe incomplete results in state: ${label}`, []);

  const contrast = Array.from(new Set(formatContrastFailures(await auditContrast(page))));
  softExpect(contrast, `measured contrast failures in state: ${label}`, []);

  await expectNoNewNonTextFailuresSoft(page, label);
  await expectScrollersReachableSoft(page, label);
  await expectNoHorizontalOverflowSoft(page, label);
}

/**
 * Wait for the handshake bars to finish widening.
 *
 * `paint()` writes each segment's width from a `setTimeout(i * 30)` chain
 * inside a `requestAnimationFrame`, so the last segment does not even START
 * until ~150ms after the click. `settle()` alone can therefore exit through the
 * gap before the first one begins, and a scan taken there measures a stack of
 * zero-width segments — which is not a state, it is a frame. Waiting on the
 * inline width matching the `data-target` the code itself wrote is the
 * completion signal the code defines.
 */
async function hsPainted(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const segs = Array.from(document.querySelectorAll<HTMLElement>('#hs-stack .hs-seg'));
    if (segs.length === 0) return false;
    // Numeric, not string: `data-target="10.920"` becomes `width: 10.92%` once
    // the CSSOM normalises it, so a string compare never matches.
    return segs.every(
      (seg) => Math.abs(parseFloat(seg.style.width) - parseFloat(seg.dataset.target ?? 'NaN')) < 0.01
    );
  });
}

// ── The drive ───────────────────────────────────────────────────────────────

/** Click a control, wait for it to report the selected state, then scan. */
async function pick(
  page: Page,
  target: Locator,
  attr: string,
  scanAt: (s: string) => Promise<void>,
  label: string,
  after?: (p: Page) => Promise<void>
): Promise<void> {
  await target.click();
  await expect(target).toHaveAttribute(attr, 'true');
  if (after) await after(page);
  await scanAt(label);
}

/**
 * Drive the lab through the states that render content, scanning each.
 *
 * Six things shape this drive:
 *
 *  - EVERY FORK IS DRIVEN THROUGH EVERY BRANCH, not merely off its default.
 *    Five family tabs, four subview tabs per family, three size metrics, five
 *    context tabs, three audience modes plus "All", three recommender needs and
 *    four priorities, five handshake presets, three chain depths, four lattice
 *    bases and two reduction actions, three ISD parameter sets and three toy
 *    forgery widths. The gate this replaces scanned exactly one branch of each
 *    of those, and did so with all four subview panels open simultaneously.
 *
 *  - THE AUDIENCE FILTER IS DRIVEN FIRST AND WITH INTENT. Picking any audience
 *    other than "All" sets `html[data-audience]`, which fades every
 *    non-headline `.lab-section` to `opacity: 0.55`. That multiplies into every
 *    ink in those sections, including several already carrying their own
 *    `opacity: .78`. It is the single largest change of rendering this page can
 *    make, it is one click from the top of the document, and the old gate never
 *    made it.
 *
 *  - EVERY PANEL THAT SHIPS `hidden` IS REACHED THROUGH THE STATE THAT SHOWS IT.
 *    `#broken-banner` needs a broken family selected; `#hs-broken` needs the
 *    "Broken combo" preset; `.pinned-drawer` needs something pinned. All three
 *    are asserted hidden first, so the arrival rendering is measured too.
 *
 *  - PREREQUISITES ARE SCANNED BEFORE THEIR UNLOCK. The four Lamport controls
 *    are asserted disabled, the keypair is generated, and they are asserted
 *    enabled — so the locked rendering is measured as well as the unlocked one.
 *
 *  - THE SLIDERS GO TO THEIR EXTREMES. The three ISD ranges drive the cost
 *    readout across its whole span, which is where a number long enough to
 *    overflow its cell appears if one ever does.
 *
 *  - NO FIXED TIMEOUTS. Every step has a DOM completion signal: an
 *    `aria-selected`, an `aria-pressed`, a readout leaving `—`, a button
 *    returning from `disabled`, a panel becoming visible. The drive waits on
 *    those. The gate this replaces waited on `page.waitForTimeout(200)`.
 */
export async function driveAllStates(page: Page, theme: string): Promise<void> {
  const scanAt = (s: string): Promise<void> => scan(page, `${theme} / ${s}`);

  await scanAt('first paint, three panels hidden and four Lamport controls locked');

  // Two skip links. The shared bar's is the first focusable element; the lab's
  // own sits after the whole `.cl-topbar`, so it is the sixth tab stop.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  await page.keyboard.press('Tab');
  await expect(page.locator('a.cl-skip-link')).toBeFocused();
  await scanAt('shared skip link focused (tab stop 1)');
  // Four, not five: the shared bar used to carry a theme toggle between the
  // brand and the lab's own skip link, and removing it removed a tab stop.
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  await expect(page.locator('a.skip-link')).toBeFocused();
  await scanAt("the lab's own skip link focused (tab stop 5)");

  // ── The audience filter: the 0.55 whole-section fade ────────────────────
  for (const who of ['student', 'engineer', 'executive'] as const) {
    await page.click(`[data-audience-btn="${who}"]`);
    await expect(page.locator('html')).toHaveAttribute('data-audience', who);
    await scanAt(`audience = ${who}, every non-headline section faded to 0.55`);
  }
  await page.click('[data-audience-btn="all"]');
  await scanAt('audience back to All, no section faded');

  // ── The family explorer: five families x the broken banner ──────────────
  for (const fam of ['code', 'hash', 'multivariate', 'isogeny'] as const) {
    await page.click(`#family-tab-${fam}`);
    await expect(page.locator(`#family-tab-${fam}`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#family-detail')).not.toBeEmpty();
    await scanAt(`family = ${fam}`);
  }
  // Isogeny is a broken family, so the banner that ships hidden is now up.
  await expect(page.locator('#broken-banner')).toBeVisible();
  await expect(page.locator('#broken-banner-text')).not.toBeEmpty();
  await scanAt('the broken-family banner, on the family that raises it');

  // Every subview, on a BROKEN family — where the Attacks pane has content the
  // healthy families do not.
  for (const view of ['math', 'attacks', 'sources'] as const) {
    await page.click(`.subview-tab[data-view="${view}"]`);
    await expect(page.locator(`.subview-tab[data-view="${view}"]`)).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.locator(`.subview-panel[data-pane="${view}"]`)).toBeVisible();
    await expect(page.locator('.subview-panel:not([hidden])')).toHaveCount(1);
    await scanAt(`isogeny / ${view} subview — the .math-row animation end state`);
  }

  await page.click('#family-tab-lattice');
  await expect(page.locator('#broken-banner')).toBeHidden();
  await scanAt('back to lattice, banner retracted');

  // ── Pins and the drawer that ships hidden ───────────────────────────────
  const pins = page.locator('.pin-btn');
  await pins.first().click();
  await expect(pins.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.pinned-drawer')).toBeVisible();
  await scanAt('one scheme pinned, the compare drawer revealed');
  await pins.nth(1).click();
  await expect(page.locator('.pinned-drawer .pin-chip')).toHaveCount(2);
  await scanAt('two schemes pinned');
  await page.locator('.pinned-drawer [data-unpin]').first().click();
  await expect(page.locator('.pinned-drawer .pin-chip')).toHaveCount(1);
  await scanAt('one unpinned from the drawer');

  // ── The recommender: every need x every priority that changes the answer ─
  for (const need of ['kem', 'sig', 'both'] as const) {
    await pick(page, page.locator(`.rec-chip[data-id="${need}"]`), 'aria-checked', scanAt, `recommender need = ${need}`);
  }
  for (const prio of ['diversity', 'output', 'pk', 'primary'] as const) {
    await pick(page, page.locator(`.rec-chip[data-id="${prio}"]`), 'aria-checked', scanAt, `recommender priority = ${prio}`);
  }
  await page.locator('.rec-try').click();
  await hsPainted(page);
  await scanAt('recommendation applied to the handshake calculator');

  // ── The handshake calculator ────────────────────────────────────────────
  for (const preset of ['nist', 'hybrid', 'conservative', 'compact'] as const) {
    await page.click(`[data-preset="${preset}"]`);
    await expect(page.locator('#hs-stack .hs-row')).toHaveCount(2);
    await hsPainted(page);
    await scanAt(`handshake preset = ${preset}`);
  }
  // The one preset that raises the panel shipping `hidden`.
  await expect(page.locator('#hs-broken')).toBeHidden();
  await page.click('[data-preset="broken"]');
  await expect(page.locator('#hs-broken')).toBeVisible();
  await hsPainted(page);
  await expect(page.locator('#hs-broken .hs-broken-item')).not.toHaveCount(0);
  await expect(page.locator('#hs-note .hs-note-warn')).toBeVisible();
  await scanAt('handshake with a broken scheme — #hs-broken, its only state');

  await page.check('#hs-hybrid');
  await expect(page.locator('#hs-hybrid')).toBeChecked();
  await hsPainted(page);
  await scanAt('hybrid hedge on — X25519 + ECDSA bytes added to every segment');
  await page.uncheck('#hs-hybrid');
  await hsPainted(page);
  await scanAt('hybrid hedge back off, PQ-only byte counts');
  for (const depth of ['1', '2'] as const) {
    await pick(page, page.locator(`.hs-chain-btn[data-depth="${depth}"]`), 'aria-checked', scanAt, `certificate chain depth = ${depth}`, hsPainted);
  }
  await pick(page, page.locator('.hs-chip[data-name="Classic McEliece 348864"]'), 'aria-checked', scanAt, 'KEM = Classic McEliece, the largest public key on the page', hsPainted);
  await pick(page, page.locator('.hs-chip[data-name="SLH-DSA-128f (SPHINCS+)"]'), 'aria-checked', scanAt, 'signature = SLH-DSA-128f, the largest signature on the page', hsPainted);

  // ── The Lamport lab ─────────────────────────────────────────────────────
  for (const sel of LOCKED_CONTROLS) await expect(page.locator(sel)).toBeDisabled();
  await page.click('#lamport-gen');
  await expect(page.locator('#lamport-sign')).toBeEnabled();
  await expect(page.locator('#lamport-priv')).toContainText('16,384 B');
  await expect(page.locator('#lamport-verify')).toBeDisabled();
  await scanAt('Lamport keypair generated, sign unlocked and verify still locked');

  await page.click('#lamport-sign');
  await expect(page.locator('#lamport-sig')).toContainText('8,192 B');
  await expect(page.locator('#lamport-verify')).toBeEnabled();
  await expect(page.locator('#lamport-grid-summary')).toContainText('exactly one private half');
  await scanAt('signed once, 256 secrets revealed and the grid repainted');

  await page.click('#lamport-verify');
  await expect(page.locator('#lamport-result.lamport-ok')).toContainText('✓ valid');
  await scanAt('verification passed — the .lamport-ok ink');

  await page.click('#lamport-tamper');
  await expect(page.locator('#lamport-result.lamport-bad')).toContainText('✗ INVALID');
  await scanAt('tampered message rejected — the .lamport-bad ink, its only state');

  await page.click('#lamport-sign2');
  await expect(page.locator('#lamport-leak-both')).toContainText('of 256');
  await expect(page.locator('#lamport-grid-summary')).toContainText('leak both private halves');
  await expect(page.locator('#lamport-grid .lc--both').first()).toBeVisible();
  await scanAt('second signature under the same key — both halves leaked');

  for (const bits of ['16', '20'] as const) {
    await pick(page, page.locator(`[data-forge-bits="${bits}"]`), 'aria-pressed', scanAt, `toy forgery width = ${bits} bits`);
  }
  await page.click('#lamport-forge-run');
  await expect(page.locator('#forge-verdict')).not.toHaveText('—');
  await expect(page.locator('#forge-control')).not.toHaveText('—');
  await scanAt('the toy forgery run: real verifier accepts, control message rejected');

  // ── The lattice figure ──────────────────────────────────────────────────
  for (const preset of ['orthogonal', 'bad', 'hex', 'degenerate'] as const) {
    await page.click(`[data-lat-preset="${preset}"]`);
    await expect(page.locator('#lat-verdict')).not.toBeEmpty();
    await scanAt(`lattice basis = ${preset}`);
  }
  // `degenerate` is the one basis that is not a lattice at all, so its verdict
  // is the failure tone; leave it selected for that scan, then reduce from a
  // basis that HAS a fixed point.
  await page.click('[data-lat-preset="bad"]');
  await expect(page.locator('#lat-trace-empty')).toBeVisible();
  await page.click('[data-lat-preset="step"]');
  await expect(page.locator('#lat-steps li')).toHaveCount(1);
  await expect(page.locator('#lat-trace-empty')).toBeHidden();
  await scanAt('one Lagrange–Gauss step, the reduction trace populated');
  await page.click('[data-lat-preset="reduce-all"]');
  await expect(page.locator('#lat-steps li')).not.toHaveCount(0);
  await scanAt('reduced to the fixed point');
  // The two SVG handles are `role="button"` with `tabindex="0"`; focusing one is
  // the only way its focus indicator is ever rendered.
  await page.locator('.lat-handle--b1').focus();
  await scanAt('the b1 lattice handle focused');

  // ── The ISD cost calculator, including both slider extremes ─────────────
  for (const preset of ['mc-348864', 'mc-460896', 'mc-6688128'] as const) {
    await page.click(`[data-isd-preset="${preset}"]`);
    await scanAt(`ISD parameters = ${preset}`);
  }
  for (const [id, extreme] of [
    ['#isd-n', 'max'],
    ['#isd-t', 'max'],
    ['#isd-t', 'min'],
  ] as const) {
    const slider = page.locator(id);
    // `fill` rejects a value off the step grid, and these ranges are not on it:
    // `#isd-n` is min=500 step=32 max=8192, so 8192 is unreachable and the
    // largest value a reader can actually select is 8180. Compute the extreme
    // the CONTROL can reach rather than the attribute's nominal bound.
    const reachable = await slider.evaluate((el, which) => {
      const i = el as HTMLInputElement;
      const min = Number(i.min);
      const max = Number(i.max);
      const step = Number(i.step) || 1;
      return which === 'min' ? String(min) : String(min + Math.floor((max - min) / step) * step);
    }, extreme);
    await slider.fill(reachable);
    await expect(slider).toHaveValue(reachable);
    await scanAt(`${id} at its reachable ${extreme} (${reachable})`);
  }

  // ── The size chart's three metrics ──────────────────────────────────────
  for (const metric of ['secretKey', 'output', 'pubKey'] as const) {
    await page.click(`#metric-tab-${metric}`);
    await expect(page.locator(`#metric-tab-${metric}`)).toHaveAttribute('aria-selected', 'true');
    await scanAt(`size chart metric = ${metric}`);
  }

  // ── The five context tabs ───────────────────────────────────────────────
  for (const tab of ['harvest-now', 'why-lattices-won', 'hybrids', 'nist-categories', 'shor'] as const) {
    await page.click(`#info-tab-${tab}`);
    await expect(page.locator(`#info-tab-${tab}`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#info-panel')).not.toBeEmpty();
    await scanAt(`context tab = ${tab}`);
  }

  // ── The two disclosures, opened through their own summaries ─────────────
  const shut = page.locator('details:not([open]) > summary:visible');
  let opened = 0;
  for (let i = await shut.count(); i > 0 && opened < 10; i = await shut.count()) {
    await shut.first().click();
    opened += 1;
  }
  expect(opened, 'both glossary disclosures must be reachable by clicking a summary').toBe(2);
  await scanAt('both disclosures open');

  // ── The copy-link confirmation flash ────────────────────────────────────
  await page.click('#copy-link');
  await expect(page.locator('#copy-link')).toContainText('Copied');
  await scanAt('copy-link confirmation flashed on the button');
}
