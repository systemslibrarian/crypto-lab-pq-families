// data.ts — Post-Quantum Cryptography family comparison corpus.
// Figures reflect NIST PQC standardisation as of 2024–2025 (FIPS 203/204/205 + HQC selection).
// Sizes are representative parameter sets, in bytes, rounded to public figures.

export type Maturity = 'standardized' | 'selected' | 'research' | 'broken';

export interface Scheme {
	name: string;
	standard: string; // FIPS / draft / status label
	kind: 'KEM' | 'Signature';
	pubKey: number; // bytes
	secretKey: number; // bytes
	output: number; // ciphertext (KEM) or signature (Sig) bytes
	outputLabel: 'ciphertext' | 'signature';
	maturity: Maturity;
	note: string;
}

export interface Family {
	id: string;
	name: string;
	hardProblem: string;
	basis: string;
	maturity: Maturity;
	confidence: number; // 0–100 subjective standardisation/confidence score for the bar chart
	summary: string;
	strengths: string[];
	weaknesses: string[];
	schemes: Scheme[];
}

export const FAMILIES: Family[] = [
	{
		id: 'lattice',
		name: 'Lattice-based',
		hardProblem: 'Module-LWE / Module-SIS',
		basis: 'Finding short vectors in high-dimensional lattices',
		maturity: 'standardized',
		confidence: 95,
		summary:
			'The clear winner of NIST standardisation. Lattice problems resist both classical and quantum attack, while supporting fast operations and moderate key sizes. Both of NIST\u2019s primary picks \u2014 ML-KEM (Kyber) and ML-DSA (Dilithium) \u2014 are lattice schemes.',
		strengths: [
			'Balanced key, ciphertext, and signature sizes',
			'Very fast key generation, encapsulation, and signing',
			'Versatile \u2014 supports KEMs, signatures, and fully homomorphic encryption',
			'Strong, well-studied worst-case-to-average-case security reductions',
		],
		weaknesses: [
			'Larger keys than classical ECC (kilobytes, not dozens of bytes)',
			'Implementation pitfalls: timing leaks (KyberSlash), fault and rejection-sampling attacks',
			'Security relies on relatively young structured-lattice assumptions',
		],
		schemes: [
			{
				name: 'ML-KEM-768 (Kyber)',
				standard: 'FIPS 203',
				kind: 'KEM',
				pubKey: 1184,
				secretKey: 2400,
				output: 1088,
				outputLabel: 'ciphertext',
				maturity: 'standardized',
				note: 'NIST primary KEM; Category 3 security.',
			},
			{
				name: 'ML-DSA-65 (Dilithium)',
				standard: 'FIPS 204',
				kind: 'Signature',
				pubKey: 1952,
				secretKey: 4032,
				output: 3309,
				outputLabel: 'signature',
				maturity: 'standardized',
				note: 'NIST primary signature; Category 3 security.',
			},
			{
				name: 'Falcon-512',
				standard: 'FIPS 206 (draft, FN-DSA)',
				kind: 'Signature',
				pubKey: 897,
				secretKey: 1281,
				output: 666,
				outputLabel: 'signature',
				maturity: 'selected',
				note: 'Compact signatures via NTRU lattices; tricky constant-time floating-point sampling.',
			},
		],
	},
	{
		id: 'code',
		name: 'Code-based',
		hardProblem: 'Syndrome decoding of linear codes',
		basis: 'Decoding a random-looking linear error-correcting code',
		maturity: 'standardized',
		confidence: 80,
		summary:
			'The oldest post-quantum family, dating to McEliece in 1978 and unbroken since. Confidence is very high, but classic McEliece public keys are enormous. NIST selected HQC in 2025 as a code-based KEM backup to lattice-based ML-KEM.',
		strengths: [
			'McEliece has survived 45+ years of cryptanalysis \u2014 the conservative choice',
			'Fast encapsulation and decapsulation',
			'Algorithmic diversity: a hedge if lattices are ever broken',
		],
		weaknesses: [
			'Classic McEliece public keys are hundreds of kilobytes to over a megabyte',
			'HQC and BIKE are younger and less battle-tested than McEliece',
			'Side-channel surface (timing in decoding) is comparatively under-studied',
		],
		schemes: [
			{
				name: 'Classic McEliece 348864',
				standard: 'Round 4 / draft',
				kind: 'KEM',
				pubKey: 261120,
				secretKey: 6492,
				output: 96,
				outputLabel: 'ciphertext',
				maturity: 'research',
				note: 'Huge public key, tiny ciphertext; maximal conservatism.',
			},
			{
				name: 'HQC-128',
				standard: 'NIST-selected 2025',
				kind: 'KEM',
				pubKey: 2249,
				secretKey: 2305,
				output: 4433,
				outputLabel: 'ciphertext',
				maturity: 'selected',
				note: 'Quasi-cyclic codes; chosen as code-based KEM standard.',
			},
			{
				name: 'BIKE L1',
				standard: 'Round 4',
				kind: 'KEM',
				pubKey: 1541,
				secretKey: 5223,
				output: 1573,
				outputLabel: 'ciphertext',
				maturity: 'research',
				note: 'Quasi-cyclic MDPC codes; small keys, decoding-failure care needed.',
			},
		],
	},
	{
		id: 'hash',
		name: 'Hash-based',
		hardProblem: 'Collision/preimage resistance of a hash function',
		basis: 'The security of an underlying hash like SHA-256 or SHAKE',
		maturity: 'standardized',
		confidence: 90,
		summary:
			'Signatures only \u2014 no encryption. Security rests entirely on a well-understood hash function, giving the most conservative security argument of any family. SLH-DSA (SPHINCS+) is stateless and standardised; LMS/XMSS are stateful and faster but require careful state management.',
		strengths: [
			'Minimal assumptions \u2014 only a secure hash is needed',
			'Extremely well-understood and quantum-resistant security basis',
			'Stateless variant (SLH-DSA) avoids catastrophic state-reuse risk',
		],
		weaknesses: [
			'Signatures only; cannot do key exchange or encryption',
			'Large signatures (8\u201350 KB) and slow signing for SLH-DSA',
			'Stateful schemes (LMS/XMSS) fail catastrophically if state is reused',
		],
		schemes: [
			{
				name: 'SLH-DSA-128f (SPHINCS+)',
				standard: 'FIPS 205',
				kind: 'Signature',
				pubKey: 32,
				secretKey: 64,
				output: 17088,
				outputLabel: 'signature',
				maturity: 'standardized',
				note: 'Stateless; tiny keys but large, slow signatures (fast variant).',
			},
			{
				name: 'XMSS (SHA-256/10)',
				standard: 'RFC 8391',
				kind: 'Signature',
				pubKey: 64,
				secretKey: 132,
				output: 2500,
				outputLabel: 'signature',
				maturity: 'standardized',
				note: 'Stateful; faster and smaller, but state must never be reused.',
			},
		],
	},
	{
		id: 'multivariate',
		name: 'Multivariate',
		hardProblem: 'Solving systems of multivariate quadratic equations (MQ)',
		basis: 'The NP-hardness of solving nonlinear equation systems over finite fields',
		maturity: 'broken',
		confidence: 25,
		summary:
			'A historically important family that produces very short signatures, but one whose flagship NIST finalist, Rainbow, was broken in 2022 by Beullens on a laptop over a weekend. It serves as the cautionary tale for why structured-lattice schemes ultimately won standardisation.',
		strengths: [
			'Very short signatures and fast verification',
			'Conceptually simple finite-field arithmetic',
			'Historically influential \u2014 drove much PQC research',
		],
		weaknesses: [
			'Rainbow was broken in 2022 (key recovery in a weekend on a laptop)',
			'Trapdoor constructions repeatedly fall to structural attacks',
			'Large public keys relative to the short signatures',
		],
		schemes: [
			{
				name: 'Rainbow (Ia)',
				standard: 'Round 3 finalist \u2014 BROKEN',
				kind: 'Signature',
				pubKey: 161600,
				secretKey: 103648,
				output: 66,
				outputLabel: 'signature',
				maturity: 'broken',
				note: 'Beullens key-recovery attack (2022) ended its candidacy.',
			},
			{
				name: 'UOV (ov-Ip)',
				standard: 'On-ramp candidate',
				kind: 'Signature',
				pubKey: 278432,
				secretKey: 237912,
				output: 128,
				outputLabel: 'signature',
				maturity: 'research',
				note: 'Unbalanced Oil-and-Vinegar; the surviving multivariate proposal.',
			},
		],
	},
	{
		id: 'isogeny',
		name: 'Isogeny-based',
		hardProblem: 'Finding isogenies between supersingular elliptic curves',
		basis: 'Walking the isogeny graph between supersingular curves',
		maturity: 'broken',
		confidence: 20,
		summary:
			'Once prized for the smallest keys of any PQC family, the leading scheme SIKE was decisively broken in 2022 by the Castryck\u2013Decru attack, which recovered keys in roughly an hour. Research continues (e.g. CSIDH, SQIsign), but the family no longer has a NIST KEM candidate.',
		strengths: [
			'Smallest public keys of any PQC family (hundreds of bytes)',
			'Elegant connection to classical elliptic-curve theory',
			'SQIsign offers very compact signatures and remains under study',
		],
		weaknesses: [
			'SIKE was broken in 2022 (Castryck\u2013Decru, key recovery in about an hour)',
			'Slow operations compared with lattice schemes',
			'No standardised KEM remains; confidence is rebuilding slowly',
		],
		schemes: [
			{
				name: 'SIKEp434',
				standard: 'Round 4 \u2014 BROKEN',
				kind: 'KEM',
				pubKey: 330,
				secretKey: 374,
				output: 346,
				outputLabel: 'ciphertext',
				maturity: 'broken',
				note: 'Tiny keys, broken by the Castryck\u2013Decru attack in 2022.',
			},
			{
				name: 'SQIsign',
				standard: 'On-ramp candidate',
				kind: 'Signature',
				pubKey: 64,
				secretKey: 16,
				output: 177,
				outputLabel: 'signature',
				maturity: 'research',
				note: 'Very compact signatures; slow, still under active study.',
			},
		],
	},
];

export const MATURITY_LABEL: Record<Maturity, string> = {
	standardized: 'Standardized',
	selected: 'Selected',
	research: 'Research',
	broken: 'Broken',
};

export function formatBytes(n: number): string {
	if (n >= 1024) {
		const kb = n / 1024;
		return `${kb >= 100 ? kb.toFixed(0) : kb.toFixed(1)} KB`;
	}
	return `${n} B`;
}
