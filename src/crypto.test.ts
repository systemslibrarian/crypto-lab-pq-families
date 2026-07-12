import { describe, it, expect } from 'vitest';
import {
	bitAt,
	determinant,
	digestMessage,
	isdPrangeBits,
	lagrangeGaussReduce,
	lagrangeGaussStep,
	lamportKeygen,
	lamportSign,
	lamportVerify,
	log2Binom,
	norm,
	orthogonalityDefect,
	sha256,
	shortestVec,
	type Vec2,
} from './crypto.ts';

function hex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

// =====================================================================
// SHA-256 known-answer tests (FIPS 180-4 examples). If SubtleCrypto or our
// wrapper regressed, these fail immediately.
// =====================================================================
describe('sha256 (WebCrypto) KATs', () => {
	it('hashes the empty string to the NIST vector', async () => {
		const d = await sha256(new Uint8Array(0));
		expect(hex(d)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
	});

	it('hashes "abc" to the NIST vector', async () => {
		const d = await sha256(new TextEncoder().encode('abc'));
		expect(hex(d)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
	});

	it('hashes the 448-bit example to the NIST vector', async () => {
		const d = await sha256(
			new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
		);
		expect(hex(d)).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
	});

	it('digestMessage produces a 32-byte digest', async () => {
		const d = await digestMessage('Hello, post-quantum world!');
		expect(d.length).toBe(32);
	});
});

// =====================================================================
// bitAt: big-endian bit indexing into a byte array.
// =====================================================================
describe('bitAt', () => {
	it('reads the MSB of byte 0 as bit 0', () => {
		expect(bitAt(new Uint8Array([0b1000_0000]), 0)).toBe(1);
		expect(bitAt(new Uint8Array([0b0111_1111]), 0)).toBe(0);
	});

	it('reads the LSB of byte 0 as bit 7', () => {
		expect(bitAt(new Uint8Array([0b0000_0001]), 7)).toBe(1);
		expect(bitAt(new Uint8Array([0b1111_1110]), 7)).toBe(0);
	});

	it('crosses byte boundaries', () => {
		const d = new Uint8Array([0x00, 0b1000_0000]);
		expect(bitAt(d, 7)).toBe(0);
		expect(bitAt(d, 8)).toBe(1);
	});

	it('enumerates all 8 bits of a known byte', () => {
		const d = new Uint8Array([0b1010_0101]);
		expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => bitAt(d, i))).toEqual([1, 0, 1, 0, 0, 1, 0, 1]);
	});
});

// =====================================================================
// Lamport one-time signatures — round-trip, forgery rejection, structure.
// =====================================================================
describe('Lamport OTS', () => {
	it('has the expected key/signature structure and 16 KB sizes', async () => {
		const kp = await lamportKeygen();
		expect(kp.priv.length).toBe(256);
		expect(kp.pub.length).toBe(256);
		expect(kp.priv[0].length).toBe(2);
		expect(kp.pub[0].length).toBe(2);
		expect(kp.priv[0][0].length).toBe(32);
		expect(kp.pub[0][0].length).toBe(32);
		// 256 positions × 2 halves × 32 bytes = 16,384 bytes each.
		const privBytes = kp.priv.reduce((s, p) => s + p[0].length + p[1].length, 0);
		expect(privBytes).toBe(16384);
	});

	it('public half is SHA-256 of the corresponding private half', async () => {
		const kp = await lamportKeygen();
		for (const i of [0, 1, 42, 255]) {
			for (const half of [0, 1] as const) {
				const expected = await sha256(kp.priv[i][half]);
				expect(hex(kp.pub[i][half])).toBe(hex(expected));
			}
		}
	});

	it('signature reveals one 32-byte secret per digest bit', async () => {
		const kp = await lamportKeygen();
		const { sig, digest } = await lamportSign(kp, 'attack at dawn');
		expect(sig.length).toBe(256);
		for (let i = 0; i < 256; i++) {
			expect(hex(sig[i])).toBe(hex(kp.priv[i][bitAt(digest, i)]));
		}
	});

	it('verifies a genuine signature (round-trip)', async () => {
		const kp = await lamportKeygen();
		const msg = 'the treaty is signed';
		const { sig } = await lamportSign(kp, msg);
		const { ok } = await lamportVerify(kp.pub, msg, sig);
		expect(ok).toBe(true);
	});

	it('rejects a signature under a different message (forgery)', async () => {
		const kp = await lamportKeygen();
		const { sig } = await lamportSign(kp, 'transfer $100');
		// Different message → different digest → mismatched revealed halves.
		const { ok } = await lamportVerify(kp.pub, 'transfer $9000', sig);
		expect(ok).toBe(false);
	});

	it('rejects a signature tampered at a single position', async () => {
		const kp = await lamportKeygen();
		const msg = 'genuine';
		const { sig } = await lamportSign(kp, msg);
		const forged = sig.slice();
		// Replace position 0 with an unrelated random secret.
		forged[0] = crypto.getRandomValues(new Uint8Array(32));
		const { ok } = await lamportVerify(kp.pub, msg, forged);
		expect(ok).toBe(false);
	});

	it('rejects a signature verified against a different public key', async () => {
		const a = await lamportKeygen();
		const b = await lamportKeygen();
		const msg = 'same message';
		const { sig } = await lamportSign(a, msg);
		const { ok } = await lamportVerify(b.pub, msg, sig);
		expect(ok).toBe(false);
	});
});

// =====================================================================
// Prange ISD work estimate — binomial identities + published parameters.
// =====================================================================
describe('log2Binom', () => {
	it('matches small exact binomials', () => {
		expect(log2Binom(4, 0)).toBe(0);
		expect(log2Binom(4, 4)).toBe(0);
		expect(2 ** log2Binom(4, 2)).toBeCloseTo(6, 6); // C(4,2)=6
		expect(2 ** log2Binom(10, 3)).toBeCloseTo(120, 4); // C(10,3)=120
		expect(2 ** log2Binom(52, 5)).toBeCloseTo(2598960, 0); // poker hands
	});

	it('is symmetric: C(n,k) = C(n,n-k)', () => {
		expect(log2Binom(100, 30)).toBeCloseTo(log2Binom(100, 70), 9);
	});

	it('returns -Infinity for out-of-range k', () => {
		expect(log2Binom(10, -1)).toBe(Number.NEGATIVE_INFINITY);
		expect(log2Binom(10, 11)).toBe(Number.NEGATIVE_INFINITY);
	});

	it('stays finite and large for cryptographic sizes', () => {
		const v = log2Binom(6688, 128);
		expect(Number.isFinite(v)).toBe(true);
		expect(v).toBeGreaterThan(700);
	});
});

describe('isdPrangeBits (Prange work in log2 bits)', () => {
	// Reference values recomputed from the exact binomial ratio for the three
	// Classic McEliece parameter sets. These pin the calculator against a
	// transcription slip in n/k/t. NOTE the honest fact these vectors capture:
	// *raw* Prange (the weakest ISD) lands right at / slightly below the nominal
	// NIST floors (143/207/272) — the real parameter margin comes from stronger
	// ISD variants and NIST's accounting, which this simple ratio does not model.
	// The UI copy and README are written to reflect exactly this.
	const cases = [
		{ label: 'mceliece348864', n: 3488, k: 2720, t: 64, expected: 142.78 },
		{ label: 'mceliece460896', n: 4608, k: 3360, t: 96, expected: 184.89 },
		{ label: 'mceliece6688128', n: 6688, k: 5024, t: 128, expected: 262.36 },
	];

	for (const c of cases) {
		it(`${c.label} matches its reference Prange bit count`, () => {
			const bits = isdPrangeBits(c.n, c.k, c.t);
			// Self-consistency: equals log2 C(n,t) - log2 C(n-k,t).
			expect(bits).toBeCloseTo(log2Binom(c.n, c.t) - log2Binom(c.n - c.k, c.t), 6);
			// Pinned reference value (guards against an n/k/t transcription slip).
			expect(bits).toBeCloseTo(c.expected, 1);
			expect(Number.isFinite(bits)).toBe(true);
		});
	}

	it('raw Prange for the Cat-1 set lands just under the 2^143 floor (honesty guard)', () => {
		// If someone re-labels the exhibit to claim raw Prange "clears" Cat 1,
		// this documents that the textbook estimate is actually ~142.8 bits.
		expect(isdPrangeBits(3488, 2720, 64)).toBeLessThan(143);
	});

	it('exact reference: n=10,k=4,t=2 gives log2(C(10,2)/C(6,2))', () => {
		// C(10,2)=45, C(6,2)=15, ratio=3, log2 3 ≈ 1.58496.
		expect(isdPrangeBits(10, 4, 2)).toBeCloseTo(Math.log2(3), 6);
	});

	it('work increases monotonically with error weight t', () => {
		const a = isdPrangeBits(3488, 2720, 40);
		const b = isdPrangeBits(3488, 2720, 64);
		expect(b).toBeGreaterThan(a);
	});
});

// =====================================================================
// 2D lattice geometry + Lagrange–Gauss reduction.
// =====================================================================
describe('lattice geometry helpers', () => {
	it('norm and determinant on a unit square basis', () => {
		expect(norm({ x: 3, y: 4 })).toBe(5);
		expect(determinant({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1);
		expect(determinant({ x: 2, y: 0 }, { x: 0, y: 3 })).toBe(6);
	});

	it('orthogonality defect is 1 for an orthogonal basis', () => {
		expect(orthogonalityDefect({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(1, 9);
		expect(orthogonalityDefect({ x: 5, y: 0 }, { x: 0, y: 2 })).toBeCloseTo(1, 9);
	});

	it('orthogonality defect exceeds 1 for a skewed basis', () => {
		expect(orthogonalityDefect({ x: 1, y: 0 }, { x: 10, y: 1 })).toBeGreaterThan(1);
	});

	it('orthogonality defect is infinite for a degenerate basis', () => {
		expect(orthogonalityDefect({ x: 1, y: 1 }, { x: 2, y: 2 })).toBe(Infinity);
	});

	it('shortestVec finds a shorter combination for a bad basis', () => {
		// b1=(1,0), b2=(3,1): the vector b2 - 3*b1 = (0,1) is shorter than both.
		const s = shortestVec({ x: 1, y: 0 }, { x: 3, y: 1 }, 5);
		expect(norm(s)).toBeCloseTo(1, 9);
	});
});

describe('Lagrange–Gauss reduction', () => {
	it('preserves the lattice determinant (unimodular operations)', () => {
		const b1: Vec2 = { x: 3, y: 1 };
		const b2: Vec2 = { x: 1, y: 2 };
		const before = determinant(b1, b2);
		const r = lagrangeGaussReduce(b1, b2);
		const after = determinant(r.b1, r.b2);
		expect(after).toBeCloseTo(before, 9);
	});

	it('reduces a skewed basis to a shorter, more orthogonal one', () => {
		const b1: Vec2 = { x: 1, y: 0 };
		const b2: Vec2 = { x: 37, y: 1 };
		const defectBefore = orthogonalityDefect(b1, b2);
		const r = lagrangeGaussReduce(b1, b2);
		const defectAfter = orthogonalityDefect(r.b1, r.b2);
		expect(defectAfter).toBeLessThan(defectBefore);
		expect(defectAfter).toBeCloseTo(1, 6); // (1,0),(0,1)-like → orthogonal
	});

	it('reaches a fixed point where ‖b1‖ ≤ ‖b2‖ and |mu| ≤ 1/2', () => {
		const r = lagrangeGaussReduce({ x: 4, y: 2 }, { x: 7, y: 3 });
		expect(norm(r.b1)).toBeLessThanOrEqual(norm(r.b2) + 1e-9);
		// One more step must not change the basis at a fixed point.
		const step = lagrangeGaussStep(r.b1, r.b2);
		expect(step.b2.x).toBeCloseTo(r.b2.x, 9);
		expect(step.b2.y).toBeCloseTo(r.b2.y, 9);
	});

	it('finds the shortest vector of the reduced basis (matches brute force)', () => {
		const b1: Vec2 = { x: 2, y: 3 };
		const b2: Vec2 = { x: 5, y: 1 };
		const r = lagrangeGaussReduce(b1, b2);
		const brute = shortestVec(b1, b2, 8);
		// The first reduced vector is a shortest lattice vector in 2D.
		expect(norm(r.b1)).toBeCloseTo(norm(brute), 6);
	});
});
