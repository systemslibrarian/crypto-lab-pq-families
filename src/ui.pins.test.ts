import { describe, expect, it } from 'vitest';

import { FAMILIES } from './data';
import { resolvePins } from './ui';

const catalogNames = FAMILIES.flatMap((family) => family.schemes).map((scheme) => scheme.name);

/**
 * `getPins()` used to hand rendering callers the strings it read out of the
 * URL. The drawer interpolates one of them into HTML, which CodeQL reported as
 * js/xss. The fix resolves them against the catalog first.
 *
 * It needs a test here rather than in the browser: the drawer ALREADY dropped
 * unknown names through its own `findSchemeByName` check, so a hostile pin
 * renders nothing under either implementation and `e2e/proof-wrapper.spec.ts`
 * passes against both — measured, with a fresh server and `reuseExistingServer`
 * off, after a stale preview server on port 4426 first made the opposite look
 * true.
 */
describe('resolvePins', () => {
	it('has a catalog to resolve against', () => {
		// Resolving against an empty catalog would drop everything and pass.
		expect(catalogNames.length).toBeGreaterThan(5);
		expect(catalogNames.every((name) => name.length > 0)).toBe(true);
	});

	it('drops a name the catalog does not define', () => {
		const real = catalogNames[0];
		const hostile = '<img src=x onerror="window.__pinnedXss=true">';
		expect([...resolvePins(`${hostile},${real}`)]).toEqual([real]);
	});

	it('every resolved name is a catalog member, whatever it was handed', () => {
		// This is the property the fix buys, and the one worth asserting: a caller
		// interpolating a resolved name into HTML is interpolating a value this app
		// defines. String IDENTITY is not observable in JS — equal strings are
		// `Object.is`-equal — so membership is the honest form of the claim.
		const hostile = ['<script>a()</script>', '" onmouseover="b()', '../../etc/passwd', '\u0000'];
		const resolved = [...resolvePins([...hostile, ...catalogNames].join(','))];
		expect(resolved.every((name) => catalogNames.includes(name))).toBe(true);
		expect(resolved.sort()).toEqual([...catalogNames].sort());
	});

	it('keeps every real name in a mixed list and no others', () => {
		const some = catalogNames.slice(0, 3);
		expect([...resolvePins([...some, 'not-a-scheme', ''].join(','))].sort()).toEqual([...some].sort());
	});

	it('resolves an empty parameter to nothing', () => {
		expect([...resolvePins('')]).toEqual([]);
	});
});
