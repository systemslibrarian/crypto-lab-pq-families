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

// Width is a parameter, not a constant. The headline exhibit runs the real
// 256-bit instance; the key-reuse forgery lab runs the SAME functions at a
// deliberately tiny width where the attacker's grind is actually feasible in a
// browser tab. One code path, two scales, so a forgery that verifies here
// verifies through exactly the routine the 256-bit panel uses.
export const LAMPORT_BITS = 256;

export async function lamportKeygen(bits: number = LAMPORT_BITS): Promise<LamportKeypair> {
	if (!Number.isInteger(bits) || bits < 1 || bits > 256) {
		throw new RangeError(`lamportKeygen: bits must be an integer in 1..256, got ${bits}`);
	}
	const flatPriv: Uint8Array[] = [];
	for (let i = 0; i < 2 * bits; i++) {
		const s = new Uint8Array(32);
		crypto.getRandomValues(s);
		flatPriv.push(s);
	}
	const hashes = await Promise.all(flatPriv.map((s) => crypto.subtle.digest('SHA-256', asBuf(s))));
	const priv: Uint8Array[][] = [];
	const pub: Uint8Array[][] = [];
	for (let i = 0; i < bits; i++) {
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
	for (let i = 0; i < kp.priv.length; i++) {
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
	if (sig.length !== pub.length) return { ok: false, digest };
	const hashes = await Promise.all(sig.map((s) => crypto.subtle.digest('SHA-256', asBuf(s))));
	for (let i = 0; i < pub.length; i++) {
		const expected = pub[i][bitAt(digest, i)];
		const actual = new Uint8Array(hashes[i]);
		if (expected.length !== actual.length) return { ok: false, digest };
		for (let k = 0; k < expected.length; k++) {
			if (expected[k] !== actual[k]) return { ok: false, digest };
		}
	}
	return { ok: true, digest };
}

// ---------------------------------------------------------------------
// 1b. What key reuse actually hands an attacker
// ---------------------------------------------------------------------
//
// A Lamport signature IS the revealed key material. An eavesdropper who sees a
// signature on m learns priv[i][bit_i(H(m))] for every i and nothing else.
// Collect several signatures and the known material accumulates: at every
// position where two digests disagree the attacker ends up holding BOTH
// preimages, and at those positions they can sign either bit.
//
// A forgery on m* is possible exactly when the attacker holds priv[i][b] for
// b = bit_i(H(m*)) at every i — i.e. when H(m*) is "covered" by the leak. With
// k signatures a random message is covered with probability ≈ 2^-(#positions
// where the leak is one-sided), so at 256 bits and two signatures the grind is
// ~2^128 and hopeless; at the toy widths in the forgery lab it finishes in a
// few hundred hashes. Nothing about the mathematics changes — only the scale.

/** Known private halves: leak[i][b] is the secret for bit value b, or null. */
export type LeakedKey = (Uint8Array | null)[][];

export function emptyLeak(bits: number): LeakedKey {
	return Array.from({ length: bits }, () => [null, null] as (Uint8Array | null)[]);
}

/** Fold one observed (digest, signature) pair into the attacker's known set. */
export function absorbSignature(
	leak: LeakedKey,
	digest: Uint8Array,
	sig: LamportSignature,
): LeakedKey {
	const out: LeakedKey = leak.map((pair) => [pair[0], pair[1]]);
	for (let i = 0; i < out.length && i < sig.length; i++) {
		out[i][bitAt(digest, i)] = sig[i];
	}
	return out;
}

export type LeakStats = { both: number; one: number; none: number; bits: number };

export function leakStats(leak: LeakedKey): LeakStats {
	let both = 0;
	let one = 0;
	let none = 0;
	for (const pair of leak) {
		const k = (pair[0] ? 1 : 0) + (pair[1] ? 1 : 0);
		if (k === 2) both++;
		else if (k === 1) one++;
		else none++;
	}
	return { both, one, none, bits: leak.length };
}

/** Positions at which two digests disagree — where reuse leaks both halves. */
export function differingBits(a: Uint8Array, b: Uint8Array, bits: number): number[] {
	const out: number[] = [];
	for (let i = 0; i < bits; i++) {
		if (bitAt(a, i) !== bitAt(b, i)) out.push(i);
	}
	return out;
}

/** True when every bit of `digest` selects a half the attacker already holds. */
export function digestCoveredBy(leak: LeakedKey, digest: Uint8Array): boolean {
	for (let i = 0; i < leak.length; i++) {
		if (!leak[i][bitAt(digest, i)]) return false;
	}
	return true;
}

/**
 * log2 of the expected number of candidate messages an attacker must hash
 * before one is covered by `leak`. Each one-sided position halves the chance;
 * a position with neither half known makes forgery impossible outright.
 */
export function forgeWorkBits(leak: LeakedKey): number {
	const { one, none } = leakStats(leak);
	return none > 0 ? Number.POSITIVE_INFINITY : one;
}

export type ForgeResult = {
	found: boolean;
	tries: number;
	message?: string;
	sig?: LamportSignature;
};

/**
 * Search `prefix + n` for a message whose digest the leak covers, and assemble
 * the forged signature from the leaked halves. Real SHA-256 on every candidate;
 * returns found:false when the budget runs out, which is the honest outcome
 * whenever the leak is too one-sided for the budget given.
 */
export async function forgeFromLeak(
	leak: LeakedKey,
	prefix: string,
	maxTries = 200_000,
): Promise<ForgeResult> {
	for (let n = 0; n < maxTries; n++) {
		const message = `${prefix}${n}`;
		const digest = await digestMessage(message);
		if (!digestCoveredBy(leak, digest)) continue;
		const sig: LamportSignature = [];
		for (let i = 0; i < leak.length; i++) {
			sig.push(leak[i][bitAt(digest, i)] as Uint8Array);
		}
		return { found: true, tries: n + 1, message, sig };
	}
	return { found: false, tries: maxTries };
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

// Brute-force shortest non-zero lattice vector within a coefficient range.
//
// NOT a general shortest-vector routine: it only searches |a|, |b| <= range, and
// a skewed basis can put the true shortest vector outside that box. Example:
// b1 = (0.9, 0), b2 = (10, 0.5) has shortest vector -11*b1 + b2 = (0.1, 0.5),
// which a range-10 search misses entirely, returning b1 (0.900) in place of the
// real answer (0.510). Kept as a test oracle for well-conditioned bases; use
// shortestVector() below for anything that claims to be *the* shortest vector.
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
//
// The detailed form reports what the step actually did — whether it swapped,
// which integer μ it rounded to, and whether the basis was already at the fixed
// point — because the swap/subtract sequence is the part worth watching. The
// plain `lagrangeGaussStep` below is the same computation with the trace thrown
// away, kept because callers and KATs use it.
export type LagrangeStep = {
	/** ‖b2‖ < ‖b1‖ on entry, so the vectors were exchanged before subtracting. */
	swapped: boolean;
	/** μ = round(⟨b1,b2⟩ / ⟨b1,b1⟩) after ordering. μ = 0 means the fixed point. */
	mu: number;
	before: { b1: Vec2; b2: Vec2 };
	after: { b1: Vec2; b2: Vec2 };
	/** True when this step changed nothing: the basis is Lagrange-reduced. */
	done: boolean;
	/**
	 * The pair spans a line (or a point), not a 2D lattice. Reduction halts here
	 * and there is no shortest NON-ZERO vector for it to have found — reporting
	 * `done` without this flag would let a caller present the zero vector, or a
	 * float-noise vector of length 1e-16, as the answer.
	 */
	degenerate: boolean;
};

export function lagrangeGaussStepDetailed(b1: Vec2, b2: Vec2): LagrangeStep {
	const before = { b1, b2 };
	let swapped = false;
	if (norm(b2) < norm(b1)) {
		const tmp = b1;
		b1 = b2;
		b2 = tmp;
		swapped = true;
	}
	// Same rank test shortestVector() uses, and for the same reason: an exact
	// `det === 0` check is useless in floating point, because a parallel pair
	// reduces to a vector of length ~1e-16 rather than to exactly (0, 0) and the
	// next μ then divides by that noise. The determinant is invariant under the
	// unimodular operations below, so testing it each step is testing the input.
	const scale = norm(b1) * norm(b2);
	if (!(scale > 0) || determinant(b1, b2) <= 1e-9 * scale) {
		return { swapped, mu: 0, before, after: { b1, b2 }, done: true, degenerate: true };
	}
	const d = dot(b1, b1);
	const mu = Math.round(dot(b1, b2) / d);
	const after =
		mu === 0 ? { b1, b2 } : { b1, b2: { x: b2.x - mu * b1.x, y: b2.y - mu * b1.y } };
	return { swapped, mu, before, after, done: mu === 0, degenerate: false };
}

export function lagrangeGaussStep(b1: Vec2, b2: Vec2): { b1: Vec2; b2: Vec2 } {
	return lagrangeGaussStepDetailed(b1, b2).after;
}

/**
 * Every step the reduction takes, in order, ending with the step that reports
 * `done` (μ = 0). The last entry's `after` is the reduced basis. Capped so a
 * degenerate basis cannot spin forever; an uncapped trace would be a hang.
 */
export function lagrangeGaussTrace(b1: Vec2, b2: Vec2, maxSteps = 200): LagrangeStep[] {
	const steps: LagrangeStep[] = [];
	let cur = { b1, b2 };
	for (let i = 0; i < maxSteps; i++) {
		const step = lagrangeGaussStepDetailed(cur.b1, cur.b2);
		steps.push(step);
		cur = step.after;
		if (step.done) break;
	}
	return steps;
}

export type ShortestVector = { x: number; y: number; a: number; b: number };

/**
 * The exact shortest non-zero vector of the 2D lattice L(b1, b2), with the
 * integer coordinates (a, b) that produce it from the ORIGINAL basis.
 *
 * Lagrange–Gauss reduction terminates with ‖v1‖ ≤ ‖v2‖ and |⟨v1, v2⟩| ≤ ‖v1‖²/2,
 * and in two dimensions that v1 is provably a shortest non-zero lattice vector —
 * no search bound, no missed answers. Tracking the unimodular transform
 * alongside the vectors is what lets the caller name the winning combination.
 *
 * Returns null for a degenerate basis (b1 and b2 parallel, det ≈ 0). The point
 * set is then rank 1, not a 2D lattice, and "the shortest non-zero vector" has
 * no well-defined answer at floating-point precision — better to say so than to
 * highlight an arbitrary vector.
 */
export function shortestVector(b1: Vec2, b2: Vec2): ShortestVector | null {
	const scale = norm(b1) * norm(b2);
	if (!(scale > 0) || determinant(b1, b2) <= 1e-9 * scale) {
		return null;
	}

	let v1 = b1;
	let v2 = b2;
	let c1 = { a: 1, b: 0 };
	let c2 = { a: 0, b: 1 };
	const swapIfNeeded = (): void => {
		if (norm(v2) < norm(v1)) {
			[v1, v2] = [v2, v1];
			[c1, c2] = [c2, c1];
		}
	};

	for (let i = 0; i < 1000; i++) {
		swapIfNeeded();
		const d = dot(v1, v1);
		if (d === 0) return null;
		const mu = Math.round(dot(v1, v2) / d);
		if (mu === 0) break;
		v2 = { x: v2.x - mu * v1.x, y: v2.y - mu * v1.y };
		c2 = { a: c2.a - mu * c1.a, b: c2.b - mu * c1.b };
	}
	swapIfNeeded();

	return { x: v1.x, y: v1.y, a: c1.a, b: c1.b };
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
