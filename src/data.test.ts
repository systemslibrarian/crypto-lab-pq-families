import { describe, it, expect } from 'vitest';
import {
	CLASSICAL_BASELINE,
	FAMILIES,
	SECURITY_CATEGORIES,
	TIMELINE,
	formatBytes,
	type Scheme,
} from './data.ts';

function findScheme(name: string): Scheme {
	for (const fam of FAMILIES) {
		const s = fam.schemes.find((x) => x.name === name);
		if (s) return s;
	}
	throw new Error(`scheme not found: ${name}`);
}

// =====================================================================
// Anchor the corpus against authoritative, non-negotiable figures. The README
// warns that many sizes are "representative and rounded" for teaching — but the
// finalised FIPS 203/204/205 parameter sizes are exact and public, so a stray
// transcription slip in these must fail CI rather than ship silently.
// =====================================================================
describe('canonical FIPS scheme sizes (exact)', () => {
	// FIPS 203, ML-KEM-768.
	it('ML-KEM-768 (Kyber)', () => {
		const s = findScheme('ML-KEM-768 (Kyber)');
		expect(s.standard).toBe('FIPS 203');
		expect(s.kind).toBe('KEM');
		expect(s.pubKey).toBe(1184);
		expect(s.secretKey).toBe(2400);
		expect(s.output).toBe(1088); // ciphertext
	});

	// FIPS 204, ML-DSA-65.
	it('ML-DSA-65 (Dilithium)', () => {
		const s = findScheme('ML-DSA-65 (Dilithium)');
		expect(s.standard).toBe('FIPS 204');
		expect(s.kind).toBe('Signature');
		expect(s.pubKey).toBe(1952);
		expect(s.secretKey).toBe(4032);
		expect(s.output).toBe(3309); // signature
	});

	// Falcon-512 (FN-DSA, FIPS 206 in development) — stable reference sizes.
	it('Falcon-512', () => {
		const s = findScheme('Falcon-512');
		expect(s.pubKey).toBe(897);
		expect(s.output).toBe(666);
	});

	// 666 is the PADDED signature size, not a fixed one: raw compressed Falcon-512
	// signatures are a distribution: 647–664 B observed over 20,000 signatures
	// with @noble/post-quantum 0.7.1 (40 keys × 500), never once reaching 666.
	// Those extremes widened from 648–663 at 4,000 samples, so the range is an
	// observation with a sample size attached, not a bound. The figure is
	// legitimate, but printed
	// bare it reads as exact in a table whose other rows genuinely are. Falcon must
	// carry the qualifier; every other scheme must NOT, or the marker stops meaning
	// anything.
	it('Falcon-512 is the only scheme whose output size is qualified', () => {
		const falcon = findScheme('Falcon-512');
		expect(falcon.outputNote).toBeTruthy();
		expect(falcon.outputNote).toMatch(/padded/i);
		expect(falcon.outputNote).toMatch(/variable/i);
		// The sample size travels with the figure: a range with no N behind it is
		// the shape that produced the wrong 652-657 in the first place.
		expect(falcon.outputNote).toMatch(/20,000 signatures/);
		expect(falcon.outputNote).toMatch(/647–664/);

		for (const f of FAMILIES) {
			for (const s of f.schemes) {
				if (s.name === 'Falcon-512') continue;
				expect(s.outputNote, `${s.name} output size is exact and must not be qualified`).toBeUndefined();
			}
		}
	});

	// FALCON was selected in 2022; FIPS 206 (FN-DSA) is "in development" on NIST's
	// own project page and absent from the CSRC FIPS publications list, which holds
	// only 203/204/205 as final. So Falcon is SELECTED, never standardized, and the
	// standard label must not imply a draft exists for a reader to go and read.
	// Verified against CSRC 2026-09-29.
	it('Falcon is selected, not standardized, and no FIPS 206 draft is implied', () => {
		const s = findScheme('Falcon-512');
		expect(s.maturity).toBe('selected');
		expect(s.standard).toContain('FIPS 206');
		expect(s.standard).not.toMatch(/draft/i);
		expect(s.standard).toMatch(/in development/i);
	});

	// FIPS 205, SLH-DSA-128f — tiny key, large signature.
	it('SLH-DSA-128f (SPHINCS+)', () => {
		const s = findScheme('SLH-DSA-128f (SPHINCS+)');
		expect(s.standard).toBe('FIPS 205');
		expect(s.pubKey).toBe(32);
		expect(s.secretKey).toBe(64);
		expect(s.output).toBe(17088); // signature
	});

	// Classic McEliece 348864 — the hallmark hundreds-of-KB public key.
	it('Classic McEliece 348864', () => {
		const s = findScheme('Classic McEliece 348864');
		expect(s.pubKey).toBe(261120);
		expect(s.output).toBe(96); // ciphertext
	});

	// Classical baseline dwarfed by every PQC scheme.
	it('X25519 + ECDSA P-256 baseline', () => {
		expect(CLASSICAL_BASELINE.kemPub).toBe(32);
		expect(CLASSICAL_BASELINE.sigPub).toBe(64);
		expect(CLASSICAL_BASELINE.sigOut).toBe(64);
	});
});

it('describes the structural McEliece estimate as a preprint with only a toy recovery', () => {
	const code = FAMILIES.find((f) => f.id === 'code')!;
	const attack = code.attacks.find((a) => a.name.includes('Weis'))!;
	expect(attack.venue).toContain('preprint');
	expect(attack.summary).toContain('toy key only');
	expect(attack.venue).toContain('October 6');
	for (const label of ['Per-run', '2^89–2^98', '2^107–2^117', '2^117–2^128', 'without memory charges', 'addressed memory', 'whole-memory accounting', '100–1,400 runs', 'one run', 'Four heuristic assumptions', 'not a practical production break']) {
		expect(attack.summary).toContain(label);
	}
	expect(code.references.find((r) => r.url === 'https://eprint.iacr.org/2026/1984')).toBeDefined();
	expect(TIMELINE.find((e) => e.title.includes('Structural estimates'))?.kind).toBe('milestone');
	expect(findScheme('Classic McEliece 348864').maturity).toBe('research');
});

// =====================================================================
// Structural invariants across the whole corpus — catch a malformed or
// half-edited entry regardless of which scheme it is.
// =====================================================================
describe('corpus structural invariants', () => {
	const allSchemes = FAMILIES.flatMap((f) => f.schemes);

	it('exposes the five PQC families exactly once each', () => {
		const ids = FAMILIES.map((f) => f.id).sort();
		expect(ids).toEqual(['code', 'hash', 'isogeny', 'lattice', 'multivariate'].sort());
		expect(new Set(ids).size).toBe(FAMILIES.length);
	});

	it('every scheme has strictly positive byte sizes', () => {
		for (const s of allSchemes) {
			expect(s.pubKey, s.name).toBeGreaterThan(0);
			expect(s.secretKey, s.name).toBeGreaterThan(0);
			expect(s.output, s.name).toBeGreaterThan(0);
		}
	});

	it('outputLabel is consistent with kind (KEM→ciphertext, Signature→signature)', () => {
		for (const s of allSchemes) {
			if (s.kind === 'KEM') expect(s.outputLabel, s.name).toBe('ciphertext');
			else expect(s.outputLabel, s.name).toBe('signature');
		}
	});

	it('broken schemes carry a brokenYear and maturity="broken"', () => {
		for (const s of allSchemes) {
			if (s.maturity === 'broken') {
				expect(s.brokenYear, s.name).toBeTypeOf('number');
				expect(s.brokenYear!, s.name).toBeGreaterThanOrEqual(2000);
			}
			if (s.brokenYear !== undefined) expect(s.maturity, s.name).toBe('broken');
		}
	});

	it('records the two 2022 practical breaks (Rainbow, SIKE)', () => {
		expect(findScheme('Rainbow (Ia)').brokenYear).toBe(2022);
		expect(findScheme('SIKEp434').brokenYear).toBe(2022);
	});

	it('security categories are drawn from the valid NIST set', () => {
		for (const s of allSchemes) {
			if (s.securityCategory !== undefined) {
				expect([1, 2, 3, 5], s.name).toContain(s.securityCategory);
			}
		}
	});

	it('confidence scores are in [0, 100]', () => {
		for (const f of FAMILIES) {
			expect(f.confidence, f.id).toBeGreaterThanOrEqual(0);
			expect(f.confidence, f.id).toBeLessThanOrEqual(100);
		}
	});

	it('exposes exactly the four NIST security categories', () => {
		expect(SECURITY_CATEGORIES.map((c) => c.level)).toEqual([1, 2, 3, 5]);
	});
});

describe('formatBytes', () => {
	it('renders bytes, KB, and MB with stable rounding', () => {
		expect(formatBytes(96)).toMatch(/96/);
		// 261,120 B is the McEliece public key — should read in KB.
		expect(formatBytes(261120)).toMatch(/KB|kB/i);
	});
});
