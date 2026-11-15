import { expect, test } from '@playwright/test';

/**
 * Page copy that was checked against a primary source on 15 November 2026 and
 * corrected. These are claims, not computed values, so nothing else in the
 * suite can catch them drifting back — each one names the figure or the term
 * the source actually prints, and asserts the wrong one is gone.
 */

test('the lattice dimension is the module dimension, not the ring degree', async ({ page }) => {
  await page.goto('.');
  // FIPS 203 Table 2: ring degree n = 256, module dimension k in {2, 3, 4}, so
  // the lattice is k*256 = 512, 768 or 1,024 dimensions.
  const footnote = page.locator('#section-lattice .section-footnote');
  await expect(footnote).toContainText('512 to 1,024 dimensions');
  await expect(footnote).toContainText('k = 2 to 4');
  await expect(footnote).not.toContainText('in 256 dimensions');
});

test('Prange succeeds on an information set that is free of errors', async ({ page }) => {
  await page.goto('.');
  // C(n-k, t) / C(n, t) counts information sets containing NONE of the t errors.
  // An information set holding all t of them is the case Prange cannot use.
  const footnote = page.locator('#section-isd .section-footnote');
  await expect(footnote).toContainText('contains none of the t errors');
  await expect(footnote).not.toContainText('contains all t errors');
});

test('OpenSSL ships ML-KEM, ML-DSA and SLH-DSA rather than flagging them', async ({ page }) => {
  await page.goto('.');
  // OpenSSL 3.5.0 [8 Apr 2025]: "Support for PQC algorithms (ML-KEM, ML-DSA and
  // SLH-DSA)". OpenSSL is the second library column.
  for (const scheme of ['ML-KEM-768', 'ML-DSA-65', 'SLH-DSA-128f (SPHINCS+)']) {
    const row = page.locator('#section-impl .impl-table tbody tr').filter({ hasText: scheme });
    await expect(row.locator('td.impl-cell').nth(1).locator('.impl-glyph')).toHaveAttribute(
      'title',
      'shipped',
    );
  }
  const footnote = page.locator('#section-impl .impl-footnote');
  await expect(footnote).toContainText('OpenSSL 3.5.0 (8 April 2025)');
  await expect(footnote).toContainText('ML-KEM, ML-DSA and SLH-DSA');
});

test('SIKE is named a fourth-round candidate and Rainbow the finalist', async ({ page }) => {
  await page.goto('.');
  // NIST IR 8545 section 2.1: of the four fourth-round KEMs only Classic
  // McEliece was a third-round finalist; BIKE, HQC and SIKE were alternates.
  await page.locator('#info-tab-why-lattices-won').click();
  const panel = page.locator('#info-panel');
  await expect(panel).toContainText('The multivariate finalist Rainbow');
  await expect(panel).toContainText('isogeny fourth-round candidate SIKE');
  await expect(panel).not.toContainText('isogeny finalists');

  const remember = page.locator('#section-remember');
  await expect(remember).toContainText('Two candidate families were broken in a single year');
  await expect(remember).not.toContainText('Two finalist families');
  // And the 2022 Rainbow break is the simple attack of ePrint 2022/214; the
  // rectangular MinRank attack is Beullens's earlier 2021 result.
  await expect(remember).toContainText("Beullens's simple attack");
  await expect(remember).not.toContainText('rectangular MinRank');
});
