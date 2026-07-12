// crypto.ts — the actual mathematics and cryptography behind the interactive
// exhibits, extracted here as pure, dependency-free functions so both the UI
// (src/ui.ts) and the unit tests (src/crypto.test.ts) run the *same* code.
//
// Three independent primitives live here:
//   1. Lamport (1979) one-time signatures over real SHA-256 (WebCrypto).
//   2. The Prange (1962) information-set-decoding log-work estimate.
//   3. Two-dimensional Lagrange–Gauss lattice basis reduction and helpers.
//
// Everything is client-side, no servers, no telemetry. If it can be tested,
// it lives here.

// =====================================================================
// 1. Lamport one-time signatures (real SHA-256 via WebCrypto)
// =====================================================================
//
// Per bit of the 256-bit message digest, the signer reveals one of two
// pre-committed 32-byte secrets. The public key is the SHA-256 of every
// secret. Verifying = hashing each revealed secret and matching it against
// the committed public half. This is genuine cryptography: signing two
// distinct messages leaks both halves at every position where the digests
// differ, which is exactly why XMSS/LMS/SPHINCS+ wrap OTS leaves in a
// Merkle/hypertree and never reuse a leaf.

export type LamportKeypair = { priv: Uint8Array[][]; pub: Uint8Array[][] };
export type LamportSignature = Uint8Array[];

// crypto.subtle.digest expects a BufferSource. TS 5.7+ types Uint8Array as
// Uint8Array<ArrayBufferLike> which isn't structurally assignable, so we route
// through a single cast helper rather than scattering casts.
function asBuf(b: Uint8Array): BufferSource {
	return b as unknown as BufferSource;
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest('SHA-256', asBuf(bytes)));
}

export async function digestMessage(msg: string): Promise<Uint8Array> {
	return sha256(new TextEncoder().encode(msg));
}

// Big-endian bit index into a byte array: bit 0 is the MSB of byte 0.
export function bitAt(digest: Uint8Array, i: number): 0 | 1 {
	return ((digest[i >> 3] >> (7 - (i & 7))) & 1) as 0 | 1;
}

export async function lamportKeygen(): Promise<LamportKeypair> {
	const flatPriv: Uint8Array[] = [];
	for (let i = 0; i < 512; i++) {
		const s = new Uint8Array(32);
		crypto.getRandomValues(s);
		flatPriv.push(s);
	}
	const hashes = await Promise.all(flatPriv.map((s) => crypto.subtle.digest('SHA-256', asBuf(s))));
	const priv: Uint8Array[][] = [];
	const pub: Uint8Array[][] = [];
	for (let i = 0; i < 256; i++) {
		priv.push([flatPriv[2 * i], flatPriv[2 * i + 1]]);
		pub.push([new Uint8Array(hashes[2 * i]), new Uint8Array(hashes[2 * i + 1])]);
	}
	return { priv, pub };
}

export async function lamportSign(
	kp: LamportKeypair,
	msg: string,
): Promise<{ sig: LamportSignature; digest: Uint8Array }> {
	const digest = await digestMessage(msg);
	const sig: LamportSignature = [];
	for (let i = 0; i < 256; i++) {
		sig.push(kp.priv[i][bitAt(digest, i)]);
	}
	return { sig, digest };
}

export async function lamportVerify(
	pub: Uint8Array[][],
	msg: string,
	sig: LamportSignature,
): Promise<{ ok: boolean; digest: Uint8Array }> {
	const digest = await digestMessage(msg);
	const hashes = await Promise.all(sig.map((s) => crypto.subtle.digest('SHA-256', asBuf(s))));
	for (let i = 0; i < 256; i++) {
		const expected = pub[i][bitAt(digest, i)];
		const actual = new Uint8Array(hashes[i]);
		if (expected.length !== actual.length) return { ok: false, digest };
		for (let k = 0; k < expected.length; k++) {
			if (expected[k] !== actual[k]) return { ok: false, digest };
		}
	}
	return { ok: true, digest };
}

// =====================================================================
// 2. Prange ISD work estimate
// =====================================================================
//
// Prange (1962) iterates a random information-set selection; each iteration
// succeeds with probability C(n-k, t) / C(n, t). Expected work is therefore
// C(n, t) / C(n-k, t) operations, ignoring polynomial factors. We compute
// log2 C(n, k) directly (summing logs of the ratio terms) so n in the
// thousands stays numerically stable — no huge intermediate factorials.
export function log2Binom(n: number, k: number): number {
	if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
	if (k === 0 || k === n) return 0;
	const kk = Math.min(k, n - k);
	let r = 0;
	for (let i = 1; i <= kk; i++) {
		r += Math.log2((n - i + 1) / i);
	}
	return r;
}

// Classical Prange work in log2 bits for code parameters (n, k, t):
//   log2( C(n, t) / C(n-k, t) ).
// Returns NEGATIVE_INFINITY / NaN-safe handling for out-of-range inputs; the
// caller should validate k < n and t <= n-k before display.
export function isdPrangeBits(n: number, k: number, t: number): number {
	return log2Binom(n, t) - log2Binom(n - k, t);
}

// =====================================================================
// 3. 2D lattice geometry + Lagrange–Gauss reduction
// =====================================================================

export type Vec2 = { x: number; y: number };

export function norm(v: Vec2): number {
	return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function dot(a: Vec2, b: Vec2): number {
	return a.x * b.x + a.y * b.y;
}

// Area of the fundamental parallelogram = |det [b1 b2]| = covolume of the lattice.
export function determinant(b1: Vec2, b2: Vec2): number {
	return Math.abs(b1.x * b2.y - b1.y * b2.x);
}

// Orthogonality defect: ‖b1‖·‖b2‖ / det. Equals 1 iff b1 ⟂ b2; grows as the
// basis becomes skewed. Infinity for a degenerate (parallel) basis.
export function orthogonalityDefect(b1: Vec2, b2: Vec2): number {
	const det = determinant(b1, b2);
	return det > 0 ? (norm(b1) * norm(b2)) / det : Infinity;
}

// Brute-force shortest non-zero lattice vector within a coefficient range —
// trivially correct for the small 2D visual and a useful test oracle.
export function shortestVec(
	b1: Vec2,
	b2: Vec2,
	range: number,
): { x: number; y: number; a: number; b: number } {
	let best = { x: b1.x, y: b1.y, a: 1, b: 0, len: norm(b1) };
	for (let a = -range; a <= range; a++) {
		for (let b = -range; b <= range; b++) {
			if (a === 0 && b === 0) continue;
			const v = { x: a * b1.x + b * b2.x, y: a * b1.y + b * b2.y };
			const len = norm(v);
			if (len > 0 && len < best.len - 1e-9) {
				best = { ...v, a, b, len };
			}
		}
	}
	const { x, y, a, b } = best;
	return { x, y, a, b };
}

// One step of Lagrange–Gauss reduction in 2D. Ensures ‖b1‖ ≤ ‖b2‖ then
// subtracts the nearest integer multiple of b1 from b2. Iterating this to a
// fixed point yields the (provably) shortest basis in 2D.
export function lagrangeGaussStep(b1: Vec2, b2: Vec2): { b1: Vec2; b2: Vec2 } {
	if (norm(b2) < norm(b1)) {
		const tmp = b1;
		b1 = b2;
		b2 = tmp;
	}
	const mu = Math.round(dot(b1, b2) / dot(b1, b1));
	return { b1, b2: { x: b2.x - mu * b1.x, y: b2.y - mu * b1.y } };
}

// Iterate lagrangeGaussStep to a fixed point (the fully reduced basis).
export function lagrangeGaussReduce(
	b1: Vec2,
	b2: Vec2,
	maxIters = 1000,
): { b1: Vec2; b2: Vec2 } {
	let cur = { b1, b2 };
	for (let i = 0; i < maxIters; i++) {
		const next = lagrangeGaussStep(cur.b1, cur.b2);
		if (next.b2.x === cur.b2.x && next.b2.y === cur.b2.y && norm(next.b1) <= norm(next.b2)) {
			return next;
		}
		cur = next;
	}
	return cur;
}
