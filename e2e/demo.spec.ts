import { expect, test, type Page } from '@playwright/test';

/**
 * Functional gate for the live exhibits.
 *
 * The a11y suite proves the page is reachable; this one proves the page is
 * telling the truth. Every assertion below reads a value the browser computed
 * during the run — the Lamport verdicts come from lamportVerify, the leak
 * counts from the two digests SHA-256 just produced, the ISD verdicts from the
 * binomial ratio, the reduction trace from lagrangeGaussStepDetailed. Failure
 * paths are asserted alongside success paths, because an exhibit that can only
 * show success is not showing anything.
 */

async function gotoLab(page: Page): Promise<void> {
  await page.goto('.');
  await expect(page.locator('#app')).toBeVisible();
}

test.describe('Lamport one-time signature', () => {
  test('a real signature verifies and a tampered message does not', async ({ page }) => {
    await gotoLab(page);

    await page.locator('#lamport-gen').click();
    await expect(page.locator('#lamport-priv')).toContainText('16,384 B');

    await page.locator('#lamport-msg').fill('claim-complete test message');
    await page.locator('#lamport-sign').click();
    await expect(page.locator('#lamport-digest')).toContainText('SHA-256(');
    await expect(page.locator('#lamport-sig')).toContainText('256 revealed secrets');

    await page.locator('#lamport-verify').click();
    await expect(page.locator('#lamport-result')).toContainText('✓ valid');
    await expect(page.locator('#lamport-result')).toHaveClass(/lamport-ok/);

    // Failure path: one flipped bit in the message and the same verifier refuses.
    await page.locator('#lamport-tamper').click();
    await expect(page.locator('#lamport-result')).toContainText('✗ INVALID');
    await expect(page.locator('#lamport-result')).toHaveClass(/lamport-bad/);
    await expect(page.locator('#lamport-msg')).not.toHaveValue('claim-complete test message');
  });

  test('the grid summary tracks what has actually been revealed', async ({ page }) => {
    await gotoLab(page);
    await expect(page.locator('#lamport-grid-summary')).toContainText('No signature yet');

    await page.locator('#lamport-gen').click();
    await page.locator('#lamport-sign').click();
    await expect(page.locator('#lamport-grid-summary')).toContainText(
      '256 positions have exactly one private half revealed',
    );
    await expect(page.locator('#lamport-grid-summary')).toContainText('no position leaks both');
  });

  test('a second signature leaks both halves at exactly the differing bits', async ({ page }) => {
    await gotoLab(page);
    await page.locator('#lamport-gen').click();
    await page.locator('#lamport-sign').click();

    await expect(page.locator('#lamport-sign2')).toBeEnabled();
    await page.locator('#lamport-sign2').click();

    const both = page.locator('#lamport-leak-both');
    await expect(both).toContainText('of 256');

    // The two counts the page prints must agree with each other, and with the
    // 256-bit total. Nothing here is a fixed expected number: the digests are
    // whatever SHA-256 produced for these two messages.
    const bothText = (await both.textContent()) ?? '';
    const m = bothText.match(/^(\d+) of 256 · digests differ at (\d+) positions$/);
    expect(m, `unexpected leak readout: ${bothText}`).not.toBeNull();
    const bothCount = Number(m![1]);
    const diffCount = Number(m![2]);
    expect(bothCount).toBe(diffCount);
    // Two independent SHA-256 digests agree on a given bit with probability 1/2;
    // a run with 0 or 256 differing bits would mean the leak logic is not looking
    // at the digests at all.
    expect(bothCount).toBeGreaterThan(60);
    expect(bothCount).toBeLessThan(196);

    const oneText = (await page.locator('#lamport-leak-one').textContent()) ?? '';
    const oneCount = Number((oneText.match(/^(\d+) of 256/) ?? [])[1]);
    expect(bothCount + oneCount).toBe(256);

    // The advertised grind must be 2^(one-sided positions), computed, not stated.
    await expect(page.locator('#lamport-forge-work')).toContainText(`≈ 2^${oneCount}`);
    await expect(page.locator('#lamport-grid-summary')).toContainText(
      `${bothCount} of 256 positions leak both private halves`,
    );
  });

  test('regenerating the keypair wipes the attacker view', async ({ page }) => {
    await gotoLab(page);
    await page.locator('#lamport-gen').click();
    await page.locator('#lamport-sign').click();
    await page.locator('#lamport-sign2').click();
    await expect(page.locator('#lamport-leak-both')).toContainText('of 256');

    await page.locator('#lamport-gen').click();
    await expect(page.locator('#lamport-leak-both')).toHaveText('—');
    await expect(page.locator('#lamport-forge-work')).toHaveText('—');
    await expect(page.locator('#lamport-sign2')).toBeDisabled();
  });
});

test.describe('toy-width key-reuse forgery', () => {
  test('the real verifier accepts the forgery and rejects the control', async ({ page }) => {
    await gotoLab(page);

    await page.locator('#lamport-forge-run').click();

    const verdict = page.locator('#forge-verdict');
    await expect(verdict).toContainText('✓ ACCEPTED', { timeout: 30_000 });
    await expect(verdict).toContainText('lamportVerify() returned true');
    await expect(verdict).toHaveClass(/lamport-ok/);

    // The search must report a real candidate count and a real forged message.
    await expect(page.locator('#forge-search')).toContainText('candidate hashes');
    await expect(page.locator('#forge-search')).toContainText('FORGED — pay Mallory');

    // Failure path: a message the leak does not cover is rejected by the same
    // verifier that just accepted the forgery.
    const control = page.locator('#forge-control');
    await expect(control).toContainText('✗ REJECTED');
    await expect(control).toHaveClass(/lamport-ok/); // green: the control failing is the good outcome

    // The leak line must be internally consistent: both + one = width.
    const leakText = (await page.locator('#forge-leak').textContent()) ?? '';
    const lm = leakText.match(/both halves at (\d+) positions · one half at (\d+)/);
    expect(lm, `unexpected forge leak readout: ${leakText}`).not.toBeNull();
    expect(Number(lm![1]) + Number(lm![2])).toBe(12);
    await expect(page.locator('#forge-keygen')).toContainText('12-bit Lamport · 24 secrets');
  });

  test('switching the toy width changes the instance that is actually run', async ({ page }) => {
    await gotoLab(page);

    await page.locator('[data-forge-bits="16"]').click();
    await expect(page.locator('[data-forge-bits="16"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-forge-bits="12"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#forge-width-label')).toHaveText('16');

    await page.locator('#lamport-forge-run').click();
    await expect(page.locator('#forge-keygen')).toContainText('16-bit Lamport · 32 secrets', {
      timeout: 30_000,
    });
    await expect(page.locator('#forge-verdict')).toContainText('✓ ACCEPTED', { timeout: 30_000 });

    const leakText = (await page.locator('#forge-leak').textContent()) ?? '';
    const lm = leakText.match(/both halves at (\d+) positions · one half at (\d+)/);
    expect(lm).not.toBeNull();
    expect(Number(lm![1]) + Number(lm![2])).toBe(16);
  });
});

test.describe('Lagrange–Gauss reduction trace', () => {
  test('a bad basis reduces over visible steps and stops at the fixed point', async ({ page }) => {
    await gotoLab(page);

    await page.locator('[data-lat-preset="bad"]').click();
    await expect(page.locator('#lat-steps li')).toHaveCount(0);
    const defectBefore = Number(await page.locator('.lat-defect').textContent());
    expect(defectBefore).toBeGreaterThan(4);
    expect(Number.isFinite(defectBefore)).toBe(true); // full rank: a real lattice
    await expect(page.locator('#lat-verdict')).toContainText('Bad basis');

    // One click = one step, and the step says what it did.
    await page.locator('[data-lat-preset="step"]').click();
    await expect(page.locator('#lat-steps li')).toHaveCount(1);
    await expect(page.locator('#lat-steps li').first()).toContainText('Step 1');
    await expect(page.locator('#lat-steps li').first()).toContainText('μ =');

    // Run to the fixed point: more steps, and the last one says so.
    await page.locator('[data-lat-preset="reduce-all"]').click();
    const steps = page.locator('#lat-steps li');
    const count = await steps.count();
    expect(count).toBeGreaterThan(1);
    await expect(steps.nth(count - 1)).toContainText('Fixed point');
    await expect(steps.nth(count - 1)).toContainText('μ = 0');

    // The intermediate steps are real work, not decoration.
    for (let i = 0; i < count - 1; i++) {
      await expect(steps.nth(i)).toContainText('b₂ ← b₂ −');
      await expect(steps.nth(i)).not.toContainText('Fixed point');
    }

    const defectAfter = Number(await page.locator('.lat-defect').textContent());
    expect(defectAfter).toBeLessThan(defectBefore);
    await expect(page.locator('#lat-verdict')).toContainText('basis');
  });

  test('an already-reduced basis reaches the fixed point in one step', async ({ page }) => {
    await gotoLab(page);
    await page.locator('[data-lat-preset="orthogonal"]').click();
    await page.locator('[data-lat-preset="reduce-all"]').click();
    await expect(page.locator('#lat-steps li')).toHaveCount(1);
    await expect(page.locator('#lat-steps li').first()).toContainText('Fixed point');
  });

  test('a parallel pair is reported as not a lattice, not as a reduced basis', async ({ page }) => {
    await gotoLab(page);
    await page.locator('[data-lat-preset="degenerate"]').click();
    await expect(page.locator('.lat-short-text')).toContainText('undefined');
    await expect(page.locator('.lat-defect')).toHaveText('∞');

    await page.locator('[data-lat-preset="reduce-all"]').click();
    const steps = page.locator('#lat-steps li');
    const count = await steps.count();
    expect(count).toBeGreaterThan(0);
    const last = steps.nth(count - 1);
    await expect(last).toContainText('span a line, not a 2D lattice');
    // It must NOT claim a fixed point with a shortest vector — the whole bug.
    await expect(last).not.toContainText('Fixed point');
    await expect(page.locator('#lat-steps li')).not.toContainText(
      'b₁ is a shortest non-zero vector',
    );
  });

  test('choosing a new basis discards the trace it no longer describes', async ({ page }) => {
    await gotoLab(page);
    await page.locator('[data-lat-preset="bad"]').click();
    await page.locator('[data-lat-preset="reduce-all"]').click();
    expect(await page.locator('#lat-steps li').count()).toBeGreaterThan(0);
    await page.locator('[data-lat-preset="hex"]').click();
    await expect(page.locator('#lat-steps li')).toHaveCount(0);
    await expect(page.locator('#lat-trace-empty')).toBeVisible();
  });
});

test.describe('ISD work calculator', () => {
  test('each McEliece preset lands in the category the binomial ratio implies', async ({ page }) => {
    await gotoLab(page);

    // Cat 1 parameters: raw Prange comes out at 142.8 bits — just under the 143-bit
    // Cat 1 floor, which is exactly the caveat the section makes about textbook ISD.
    await page.locator('[data-isd-preset="mc-348864"]').click();
    await expect(page.locator('.isd-bits')).toHaveText('142.8 bits');
    await expect(page.locator('.isd-qbits')).toHaveText('≈ 71.4 bits');
    await expect(page.locator('.isd-cat')).toContainText('near Cat 1 floor');
    await expect(page.locator('.isd-cat')).toHaveClass(/isd-cat--mid/);

    await page.locator('[data-isd-preset="mc-460896"]').click();
    await expect(page.locator('.isd-bits')).toHaveText('184.9 bits');
    await expect(page.locator('.isd-cat')).toContainText('≥ Cat 1 floor');
    await expect(page.locator('.isd-cat')).toHaveClass(/isd-cat--ok/);

    await page.locator('[data-isd-preset="mc-6688128"]').click();
    await expect(page.locator('.isd-bits')).toHaveText('262.4 bits');
    await expect(page.locator('.isd-cat')).toContainText('≥ Cat 3 floor');
    await expect(page.locator('.isd-cat')).toHaveClass(/isd-cat--ok/);
  });

  test('weak parameters are reported as weak', async ({ page }) => {
    await gotoLab(page);
    await page.locator('[data-isd-preset="mc-348864"]').click();
    await page.locator('#isd-t').fill('10');
    await expect(page.locator('.isd-bits')).toHaveText('21.9 bits');
    await expect(page.locator('.isd-cat')).toContainText('well below PQC-grade');
    await expect(page.locator('.isd-cat')).toHaveClass(/isd-cat--bad/);
  });
});

test.describe('broken-scheme hand-off', () => {
  test('the broken preset explains the break and links to the lab that runs it', async ({
    page,
  }) => {
    await gotoLab(page);

    const panel = page.locator('#hs-broken');
    await expect(panel).toBeHidden();

    await page.locator('[data-preset="broken"]').click();
    await expect(panel).toBeVisible();

    // Both halves of the combo are dead, and each names its own cryptanalysis.
    await expect(panel).toContainText('SIKEp434');
    await expect(panel).toContainText('Rainbow (Ia)');
    await expect(panel).toContainText('Castryck–Decru key recovery on SIDH/SIKE');
    await expect(panel).toContainText('Beullens: Rainbow key recovery');

    // And each hands off to the sibling lab that actually demonstrates it.
    await expect(panel.locator('[data-break-lab="isogeny"]')).toHaveAttribute(
      'href',
      'https://systemslibrarian.github.io/crypto-lab-isogeny-gate/',
    );
    await expect(panel.locator('[data-break-lab="multivariate"]')).toHaveAttribute(
      'href',
      'https://systemslibrarian.github.io/crypto-lab-multivariate/',
    );

    // Selecting a live scheme retires the panel again.
    await page.locator('[data-preset="nist"]').click();
    await expect(panel).toBeHidden();
  });
});
