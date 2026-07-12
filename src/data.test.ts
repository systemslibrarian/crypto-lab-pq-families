import { describe, it, expect } from 'vitest';
import {
	CLASSICAL_BASELINE,
	FAMILIES,
	SECURITY_CATEGORIES,
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

	// Falcon-512 (FN-DSA draft) — stable reference sizes.
	it('Falcon-512', () => {
		const s = findScheme('Falcon-512');
		expect(s.pubKey).toBe(897);
		expect(s.output).toBe(666);
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
