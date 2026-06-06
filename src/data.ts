// data.ts — Post-Quantum Cryptography family comparison corpus.
// Figures reflect NIST PQC standardisation as of 2024–2025 (FIPS 203/204/205 + HQC selection).
// Sizes are representative parameter sets, in bytes, rounded to public figures.

export type Maturity = 'standardized' | 'selected' | 'research' | 'broken';

// NIST PQC security categories (NISTIR 8413). Category 1 ≈ AES-128 brute-force
// effort, 3 ≈ AES-192, 5 ≈ AES-256; 2 / 4 are pegged to SHA-256 / SHA-384
// collision search. Categories cover both classical and quantum effort.
export type SecurityCategory = 1 | 2 | 3 | 5;

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
	brokenYear?: number; // year the scheme was broken, when applicable
	securityCategory?: SecurityCategory;
	performance?: string; // brief qualitative speed note
	cyclesNote?: string; // approximate CPU cycle counts (Skylake / ref impl); for orders-of-magnitude only
}

export interface Attack {
	year: number;
	name: string;
	summary: string;
}

export interface Reference {
	authors: string;
	year: number;
	title: string;
	venue?: string;
	url?: string;
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
	mathProblem: string; // formal-ish statement of the underlying hard problem
	reductionNote?: string; // what the problem reduces from, or its hardness pedigree
	attacks: Attack[];
	references: Reference[];
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
				securityCategory: 3,
				performance: 'Microsecond-class keygen / encap / decap on commodity CPUs.',
				cyclesNote: 'keygen ≈ 14k · encap ≈ 17k · decap ≈ 21k cycles (AVX2 ref, Skylake)',
				note: 'NIST primary KEM. Built on Module-LWE over R_q = Z_q[x]/(x^256 + 1) with q = 3329, dimension k = 3.',
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
				securityCategory: 3,
				performance: 'Sub-millisecond signing and verification on commodity CPUs.',
				cyclesNote: 'keygen ≈ 0.3M · sign ≈ 1.0M · verify ≈ 0.3M cycles (AVX2 ref, Skylake)',
				note: 'NIST primary signature. Fiat–Shamir with aborts; relies on Module-LWE + Module-SIS.',
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
				securityCategory: 1,
				performance: 'Verification fast; signing dominated by constant-time Gaussian sampling over NTRU lattices.',
				cyclesNote: 'keygen ≈ 20M · sign ≈ 0.7M · verify ≈ 90k cycles (ref impl, Skylake)',
				note: 'Hash-and-sign via the GPV framework; compact signatures but a notoriously tricky implementation.',
			},
		],
		mathProblem:
			'R_q = Z_q[x] / (x^n + 1), with q a small prime and n a power of two.\n\nModule-LWE: Given (A, b = A·s + e) with A ∈ R_q^(k×ℓ) uniform, secret s ∈ R_q^ℓ and small noise e ∈ R_q^k, recover s. The decision variant asks whether (A, b) is uniform or LWE-distributed.\n\nModule-SIS: Given A ∈ R_q^(k×ℓ), find a non-zero z ∈ R_q^ℓ with A·z = 0 and ‖z‖ ≤ β.',
		reductionNote:
			'Module-LWE admits a worst-case → average-case reduction from approximate shortest-vector problems (GapSVP, SIVP) on module lattices (Langlois–Stehlé, Albrecht et al.). Adopting *module* structure trades a stronger assumption for substantially better efficiency than plain LWE.',
		attacks: [
			{
				year: 1982,
				name: 'LLL basis reduction (Lenstra–Lenstra–Lovász)',
				summary: 'Polynomial-time reduction yielding short-ish lattice vectors. Foundation under every modern lattice attack.',
			},
			{
				year: 1995,
				name: 'BKZ block-Korkine–Zolotarev (Schnorr–Euchner)',
				summary: 'Block-wise refinement of LLL; with sieving improvements (Chen–Nguyen, Becker–Ducas–Gama–Laarhoven) this is the cost model used to set parameters.',
			},
			{
				year: 2023,
				name: 'KyberSlash',
				summary: 'Constant-time bug in Kyber’s ciphertext compression leaked secret bits through cycle counts. Patched in all major implementations within months of disclosure.',
			},
			{
				year: 2024,
				name: 'Dual-attack re-examination',
				summary: 'Active debate around concrete BKZ + dual-attack cost; conservative parameter sets (ML-KEM-768/1024) retain comfortable margin.',
			},
		],
		references: [
			{
				authors: 'Regev',
				year: 2005,
				title: 'On lattices, learning with errors, random linear codes, and cryptography',
				venue: 'STOC 2005 / JACM 2009',
			},
			{
				authors: 'Lyubashevsky, Peikert, Regev',
				year: 2010,
				title: 'On ideal lattices and learning with errors over rings',
				venue: 'Eurocrypt 2010',
			},
			{
				authors: 'Bos et al.',
				year: 2018,
				title: 'CRYSTALS-Kyber: A CCA-secure module-lattice-based KEM',
				venue: 'EuroS&P 2018',
				url: 'https://pq-crystals.org/kyber/',
			},
			{
				authors: 'NIST',
				year: 2024,
				title: 'FIPS 203 — Module-Lattice-Based Key-Encapsulation Mechanism Standard',
				url: 'https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.203.pdf',
			},
			{
				authors: 'NIST',
				year: 2024,
				title: 'FIPS 204 — Module-Lattice-Based Digital Signature Standard',
				url: 'https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf',
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
				securityCategory: 1,
				performance: 'Encap and decap are fast; key generation takes seconds (computing a Goppa-code support).',
				cyclesNote: 'keygen ≈ 150M · encap ≈ 50k · decap ≈ 150k cycles (ref impl, Skylake)',
				note: 'Niederreiter-style KEM over a binary Goppa code. Huge public key, tiny ciphertext; maximal conservatism.',
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
				securityCategory: 1,
				performance: 'Microsecond-class operations; needs constant-time rejection-sampling care.',
				cyclesNote: 'keygen ≈ 150k · encap ≈ 250k · decap ≈ 450k cycles (ref impl, Skylake)',
				note: 'Quasi-cyclic codes with provable IND-CCA2 via the Hofheinz–Hövelmanns–Kiltz transform; selected as the code-based KEM standard.',
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
				securityCategory: 1,
				performance: 'Fast encap; decap has non-zero decoding-failure rate (DFR) that must be driven low.',
				cyclesNote: 'keygen ≈ 600k · encap ≈ 250k · decap ≈ 5M cycles (ref impl, Skylake)',
				note: 'Quasi-cyclic MDPC codes; small keys but careful DFR analysis is required.',
			},
		],
		mathProblem:
			'Syndrome Decoding Problem (SDP): Given a parity-check matrix H ∈ F_2^(r × n), a syndrome s ∈ F_2^r and a weight bound t ≥ 0, find e ∈ F_2^n with weight(e) ≤ t and H·e^T = s.\n\nDecision-SDP is NP-complete (Berlekamp–McEliece–Tilborg, 1978). McEliece-style schemes additionally rely on the indistinguishability of a hidden Goppa code from a uniformly random linear code.',
		reductionNote:
			'McEliece transforms a generator matrix of a Goppa code via secret permutation and invertible mixing so the public matrix looks random. Security rests on (1) SDP being hard for random codes and (2) the masked Goppa code being indistinguishable from random.',
		attacks: [
			{
				year: 1962,
				name: 'Prange information-set decoding (ISD)',
				summary: 'Original combinatorial decoding algorithm for random linear codes; the baseline against which all modern code-based parameters are measured.',
			},
			{
				year: 2011,
				name: 'May–Meurer–Thomae ISD',
				summary: 'Representation-based ISD with the best classical asymptotic complexity; refined by Becker–Joux–May–Meurer (2012) and Both–May (2018).',
			},
			{
				year: 2016,
				name: 'Guo–Johansson–Stankovski DFR attack',
				summary: 'Exploited decoding-failure correlations in QC-MDPC; drove BIKE to switch to CCA-secure variants with constant-time decoders.',
			},
			{
				year: 2023,
				name: 'HQC timing-leak fixes',
				summary: 'Side-channel against the rejection-sampling step; patched in NIST-submission reference code.',
			},
		],
		references: [
			{
				authors: 'McEliece',
				year: 1978,
				title: 'A public-key cryptosystem based on algebraic coding theory',
				venue: 'JPL DSN Progress Report 44',
			},
			{
				authors: 'Niederreiter',
				year: 1986,
				title: 'Knapsack-type cryptosystems and algebraic coding theory',
				venue: 'Problems of Control and Information Theory',
			},
			{
				authors: 'Misoczki, Tillich, Sendrier, Barreto',
				year: 2013,
				title: 'MDPC-McEliece: New McEliece variants from moderate density parity-check codes',
				venue: 'ISIT 2013',
			},
			{
				authors: 'Aguilar-Melchor et al.',
				year: 2017,
				title: 'Hamming Quasi-Cyclic (HQC)',
				venue: 'NIST PQC submission',
				url: 'https://pqc-hqc.org',
			},
			{
				authors: 'Classic McEliece team',
				year: 2017,
				title: 'Classic McEliece — submission specification',
				url: 'https://classic.mceliece.org',
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
				securityCategory: 1,
				performance: 'Stateless. The fast (f) variant signs in milliseconds; signing dominates verification. Small parameter sets exist for size-vs-speed tradeoffs (s-variants).',
				cyclesNote: 'keygen ≈ 0.7M · sign ≈ 250M · verify ≈ 12M cycles (ref impl, Skylake)',
				note: 'Hypertree of WOTS+ one-time signatures with FORS few-time leaves; security reduces to second-preimage resistance and pseudorandomness of a hash family.',
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
				securityCategory: 1,
				performance: 'Stateful: each signature consumes one leaf of a Merkle tree; signing fast but state-tracking must be atomic and durable.',
				cyclesNote: 'keygen ≈ 50k · sign ≈ 5k · verify ≈ 3k cycles per leaf (ref impl, Skylake)',
				note: 'Merkle-tree of WOTS+ one-time signatures. Catastrophic forgery if state is ever reused (e.g. backup restore, VM clone).',
			},
		],
		mathProblem:
			'Let H: {0,1}^* → {0,1}^n be a cryptographic hash function. Hash-based signatures reduce existential unforgeability to one or more of:\n\n  • Preimage resistance: given y = H(x), find x.\n  • Second-preimage resistance: given x, find x′ ≠ x with H(x) = H(x′).\n  • Collision resistance (for some variants): find x ≠ x′ with H(x) = H(x′).\n\nClassical security is ~ 2^n (preimage) and ~ 2^(n/2) (collision). Grover gives quantum preimage at ~ 2^(n/2) and BHT collision at ~ 2^(n/3), motivating n ≥ 256.',
		reductionNote:
			'Smallest assumption of any PQC family: tight reductions to plain hash-function properties, with no algebraic structure to hide. The price is signature size and (for the stateless variants) signing time.',
		attacks: [
			{
				year: 1979,
				name: 'Lamport one-time signatures',
				summary: 'Demonstrated that one-way functions alone suffice for signatures; not an attack but the foundation that every hash-based scheme refines.',
			},
			{
				year: 1989,
				name: 'Merkle authentication trees',
				summary: 'Reuse a one-time public key by hashing many keys into a single root; the structural ancestor of XMSS, LMS, and SPHINCS+.',
			},
			{
				year: 2002,
				name: 'Wagner generalised birthday',
				summary: 'k-list birthday attack against FORS-like few-time signatures; SPHINCS+ FORS parameters are sized to absorb it.',
			},
			{
				year: 2020,
				name: 'WOTS+ multi-target analysis',
				summary: 'Tight multi-user / multi-target bounds (Hülsing–Rijneveld–Song) that shaped SPHINCS+ parameter choices.',
			},
		],
		references: [
			{
				authors: 'Lamport',
				year: 1979,
				title: 'Constructing digital signatures from a one-way function',
				venue: 'SRI International Technical Report CSL-98',
			},
			{
				authors: 'Merkle',
				year: 1989,
				title: 'A certified digital signature',
				venue: 'Crypto 1989',
			},
			{
				authors: 'Bernstein et al.',
				year: 2019,
				title: 'SPHINCS+ — stateless hash-based signatures',
				url: 'https://sphincs.org',
			},
			{
				authors: 'NIST',
				year: 2024,
				title: 'FIPS 205 — Stateless Hash-Based Digital Signature Standard',
				url: 'https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.205.pdf',
			},
			{
				authors: 'IETF',
				year: 2018,
				title: 'RFC 8391 — XMSS: eXtended Merkle Signature Scheme',
				url: 'https://datatracker.ietf.org/doc/html/rfc8391',
			},
			{
				authors: 'IETF',
				year: 2019,
				title: 'RFC 8554 — Leighton-Micali Hash-Based Signatures (LMS)',
				url: 'https://datatracker.ietf.org/doc/html/rfc8554',
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
				brokenYear: 2022,
				securityCategory: 1,
				performance: 'Verification very fast; signing fast. Broken \u2014 not deployable. Shown here for cryptanalytic history.',
				cyclesNote: 'keygen \u2248 30M \u00b7 sign \u2248 50k \u00b7 verify \u2248 30k cycles (pre-break ref impl, Skylake)',
				note: 'Layered Oil-and-Vinegar trapdoor; Beullens\u2019s 2022 rectangular MinRank attack recovers the secret key in a weekend on a laptop.',
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
				securityCategory: 1,
				performance: 'Very fast signing and verification; key generation also fast. Bandwidth dominated by the public key.',
				cyclesNote: 'keygen \u2248 1M \u00b7 sign \u2248 50k \u00b7 verify \u2248 50k cycles (ref impl, Skylake)',
				note: 'Unbalanced Oil-and-Vinegar (Kipnis\u2013Patarin\u2013Goubin, 1999) \u2014 the surviving multivariate proposal in NIST\u2019s on-ramp signature call.',
			},
		],
		mathProblem:
			'MQ problem: Given m quadratic polynomials p_1, \u2026, p_m \u2208 F_q[x_1, \u2026, x_n], find x \u2208 F_q^n with p_i(x) = 0 for all i. The decision version is NP-complete over GF(2).\n\nMultivariate signatures expose a public map P = T \u2218 F_central \u2218 S, with secret linear maps S, T hiding a trapdoor F_central that the signer can invert. Security therefore depends on BOTH MQ-hardness AND the trapdoor remaining indistinguishable from a random MQ system.',
		reductionNote:
			'No worst-case reduction is known: hardness arguments are concrete, and history shows the trapdoor \u2014 not MQ itself \u2014 is what gets broken (HFE, SFLASH, Rainbow). UOV has survived 26+ years of analysis but at the cost of huge public keys.',
		attacks: [
			{
				year: 1995,
				name: 'Patarin: cryptanalysis of Matsumoto\u2013Imai (C*)',
				summary: 'Linearisation attack that ended the first multivariate proposal; motivated the HFE and Oil-and-Vinegar families.',
			},
			{
				year: 1999,
				name: 'Kipnis\u2013Shamir on HFE',
				summary: 'MinRank-based key recovery using the "MinRank" framework that has since become the dominant tool against multivariate trapdoors.',
			},
			{
				year: 2008,
				name: 'Dubois\u2013Fouque\u2013Stern\u2013Shamir: SFLASH break',
				summary: 'Demonstrated that even a NESSIE-recommended signature could fall to differential cryptanalysis of the central map.',
			},
			{
				year: 2022,
				name: 'Beullens: Rainbow key recovery',
				summary: 'Rectangular MinRank attack recovers Rainbow Ia keys in a weekend on a single laptop \u2014 ended the Rainbow finalist.',
			},
		],
		references: [
			{
				authors: 'Patarin',
				year: 1997,
				title: 'The Oil-and-Vinegar signature scheme',
				venue: 'Dagstuhl 1997',
			},
			{
				authors: 'Kipnis, Patarin, Goubin',
				year: 1999,
				title: 'Unbalanced Oil and Vinegar signature schemes',
				venue: 'Eurocrypt 1999',
			},
			{
				authors: 'Ding, Schmidt',
				year: 2005,
				title: 'Rainbow, a new multivariable polynomial signature scheme',
				venue: 'ACNS 2005',
			},
			{
				authors: 'Beullens',
				year: 2022,
				title: 'Breaking Rainbow takes a weekend on a laptop',
				venue: 'Crypto 2022',
			},
			{
				authors: 'NIST',
				year: 2023,
				title: 'PQC additional digital signatures (on-ramp) call',
				url: 'https://csrc.nist.gov/Projects/pqc-dig-sig',
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
				brokenYear: 2022,
				securityCategory: 1,
				performance: 'Slow keygen / encap / decap (\u2248 tens of ms). Broken \u2014 not deployable. Shown here for historical comparison.',
				cyclesNote: 'keygen \u2248 6M \u00b7 encap \u2248 10M \u00b7 decap \u2248 10M cycles (pre-break ref impl, Skylake)',
				note: 'SIDH-based KEM whose auxiliary torsion-point exposure enabled the Castryck\u2013Decru classical key recovery in 2022.',
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
				securityCategory: 1,
				performance: 'Verification fast; signing \u2248 seconds in the original construction; under active optimisation.',
				cyclesNote: 'keygen \u2248 1B \u00b7 sign \u2248 2B \u00b7 verify \u2248 50M cycles (early ref impl, Skylake)',
				note: 'Identification protocol turned signature via Fiat\u2013Shamir; relies on the Deuring correspondence between supersingular curves and quaternion orders.',
			},
		],
		mathProblem:
			'Let E_1, E_2 be supersingular elliptic curves over F_{p^2} of equal order. The supersingular isogeny problem asks for an isogeny \u03c6: E_1 \u2192 E_2 of a specified degree.\n\nSIDH/SIKE relied on a *stronger* problem: recover \u03c6 given E_1, E_2 AND the images \u03c6(P), \u03c6(Q) on a torsion basis (P, Q) of E_1. Those auxiliary torsion images were exactly what Castryck\u2013Decru exploited via Kani\u2019s theorem on isogenies of products of abelian surfaces.',
		reductionNote:
			'Best known classical algorithms for the *plain* supersingular isogeny problem are sub-exponential (Delfs\u2013Galbraith / van Oorschot\u2013Wiener style meet-in-the-middle). Quantum attacks (Childs\u2013Jao\u2013Soukharev for class-group action variants; Kuperberg\u2019s collimation algorithm for CSIDH) are also sub-exponential \u2014 much slower than Shor on RSA but not polynomial.',
		attacks: [
			{
				year: 2014,
				name: 'Delfs\u2013Galbraith claw-finding',
				summary: 'Meet-in-the-middle on the isogeny graph \u2014 the dominant classical attack on the plain supersingular isogeny problem.',
			},
			{
				year: 2018,
				name: 'Petit / GPST adaptive attacks on SIDH',
				summary: 'Early structural attacks against SIDH-with-torsion that hinted the auxiliary points were dangerous.',
			},
			{
				year: 2022,
				name: 'Castryck\u2013Decru key recovery on SIDH/SIKE',
				summary: 'Polynomial-time classical attack via Kani\u2019s theorem; ran in \u2248 1 hour on a single core. Generalised by Maino\u2013Martindale and Robert within weeks.',
			},
			{
				year: 2014,
				name: 'Kuperberg collimation against class-group actions',
				summary: 'Sub-exponential quantum attack model that drives CSIDH parameter sizes well above the original proposal.',
			},
		],
		references: [
			{
				authors: 'Jao, De Feo',
				year: 2011,
				title: 'Towards quantum-resistant cryptosystems from supersingular elliptic curve isogenies',
				venue: 'PQCrypto 2011',
			},
			{
				authors: 'Castryck, Lange, Martindale, Panny, Renes',
				year: 2018,
				title: 'CSIDH: An efficient post-quantum commutative group action',
				venue: 'Asiacrypt 2018',
			},
			{
				authors: 'Castryck, Decru',
				year: 2022,
				title: 'An efficient key recovery attack on SIDH',
				venue: 'Eurocrypt 2023',
			},
			{
				authors: 'De Feo et al.',
				year: 2020,
				title: 'SQIsign \u2014 compact post-quantum signatures from quaternions and isogenies',
				url: 'https://sqisign.org',
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

// --- Timeline ---------------------------------------------------------------
export type TimelineKind = 'theory' | 'broken' | 'standard' | 'milestone';

export interface TimelineEvent {
	year: number;
	title: string;
	kind: TimelineKind;
	body: string;
}

export const TIMELINE: TimelineEvent[] = [
	{
		year: 1978,
		title: 'McEliece cryptosystem',
		kind: 'theory',
		body: 'Robert McEliece proposes the first code-based encryption scheme. It is still unbroken 47+ years later — the conservative benchmark every later PQC scheme is measured against.',
	},
	{
		year: 1994,
		title: 'Shor’s algorithm',
		kind: 'milestone',
		body: 'Peter Shor publishes a polynomial-time quantum algorithm for integer factoring and discrete logs. RSA, Diffie–Hellman, and ECC are all broken in principle the moment a large enough quantum computer exists.',
	},
	{
		year: 1996,
		title: 'Grover’s algorithm',
		kind: 'milestone',
		body: 'Quantum search gives a quadratic speedup against generic preimage problems — the reason AES-256 and SHA-384 stay on the recommended list while everything asymmetric had to be rebuilt.',
	},
	{
		year: 2005,
		title: 'Learning With Errors (Regev)',
		kind: 'theory',
		body: 'Oded Regev introduces LWE, with reductions from worst-case lattice problems. This becomes the bedrock of modern lattice cryptography — Kyber, Dilithium, and FHE all descend from it.',
	},
	{
		year: 2016,
		title: 'NIST PQC competition opens',
		kind: 'milestone',
		body: 'NIST issues its call for post-quantum proposals. 82 candidates are submitted; the six-year selection process will define the standardised PQC portfolio.',
	},
	{
		year: 2022,
		title: 'SIKE broken in an hour',
		kind: 'broken',
		body: 'Castryck and Decru publish a classical key-recovery attack on SIKE that runs in roughly one hour on a single core. The leading isogeny KEM is out.',
	},
	{
		year: 2022,
		title: 'Rainbow broken on a laptop',
		kind: 'broken',
		body: 'Ward Beullens recovers the secret key of Rainbow Ia in a weekend on a single laptop. The leading multivariate signature is out.',
	},
	{
		year: 2024,
		title: 'FIPS 203 / 204 / 205 published',
		kind: 'standard',
		body: 'ML-KEM (Kyber), ML-DSA (Dilithium), and SLH-DSA (SPHINCS+) become US federal standards. Lattices take the primary slot; hash-based serves as the conservative backup.',
	},
	{
		year: 2025,
		title: 'HQC selected as second KEM',
		kind: 'standard',
		body: 'NIST chooses HQC as a code-based backup to ML-KEM, securing algorithmic diversity in the KEM portfolio in case lattices are ever weakened.',
	},
];

export const TIMELINE_KIND_LABEL: Record<TimelineKind, string> = {
	theory: 'Theory',
	broken: 'Broken',
	standard: 'Standard',
	milestone: 'Milestone',
};

// --- Classical baseline for the handshake calculator -----------------------
// X25519 (ephemeral DH) + ECDSA P-256 (cert pubkey + cert sig + transcript sig).
// In TLS 1.3 the bytes-on-wire for the handshake key-exchange + auth are roughly:
//   client_key_share (KEM pubkey) + server_key_share (KEM ct)
//   + server cert pubkey + cert chain sig + transcript signature
// For an ephemeral DH like X25519 the "KEM" pubkey and "ciphertext" are both 32 B.
export interface ClassicalBaseline {
	name: string;
	kemPub: number;
	kemOut: number;
	sigPub: number;
	sigOut: number;
}

export const CLASSICAL_BASELINE: ClassicalBaseline = {
	name: 'X25519 + ECDSA P-256',
	kemPub: 32,
	kemOut: 32,
	sigPub: 64,
	sigOut: 64,
};

// Hybrid hedge: classical X25519 KEM shares + ECDSA P-256 cert pubkey & sigs
// added alongside the PQC scheme. This is the recipe used in current TLS hybrid drafts.
export const HYBRID_OVERHEAD: ClassicalBaseline = CLASSICAL_BASELINE;

// --- NIST PQC security categories (NISTIR 8413, table 3) -------------------
export interface SecurityCategoryDescriptor {
	level: SecurityCategory;
	floor: string; // classical effort floor
	example: string; // representative classical primitive
	note: string;
}

export const SECURITY_CATEGORIES: SecurityCategoryDescriptor[] = [
	{
		level: 1,
		floor: '≥ 2^143 classical, ≥ 2^74 quantum (gate cost model)',
		example: 'Exhaustive key search of AES-128',
		note: 'Minimum acceptable category — used by Falcon-512, McEliece-348864, HQC-128, SLH-DSA-128f.',
	},
	{
		level: 2,
		floor: '≥ 2^146 classical for SHA-256 collision',
		example: 'Collision search on SHA-256',
		note: 'Rarely targeted directly; sits between Cat 1 and Cat 3 in cost.',
	},
	{
		level: 3,
		floor: '≥ 2^207 classical, ≥ 2^137 quantum',
		example: 'Exhaustive key search of AES-192',
		note: 'NIST primaries (ML-KEM-768, ML-DSA-65) target this level — the production sweet spot.',
	},
	{
		level: 5,
		floor: '≥ 2^272 classical, ≥ 2^200 quantum',
		example: 'Exhaustive key search of AES-256',
		note: 'Conservative top-tier parameters (ML-KEM-1024, ML-DSA-87, SLH-DSA-256s).',
	},
];

// --- Glossary --------------------------------------------------------------
// Short, cite-able definitions for the jargon that appears throughout the lab.
// Grouped here so the UI can render them as a single section without duplication.
export interface GlossaryEntry {
	term: string;
	def: string;
}

export const GLOSSARY: GlossaryEntry[] = [
	{
		term: 'KEM (Key Encapsulation Mechanism)',
		def: 'A public-key primitive whose API is (encapsulate, decapsulate): the sender produces a random shared secret + ciphertext, the receiver recovers the secret from the ciphertext. Standard replacement for "public-key encryption of a session key" in TLS.',
	},
	{
		term: 'IND-CCA2',
		def: 'Indistinguishability under adaptive chosen-ciphertext attack — the standard security notion for a KEM. ML-KEM and HQC achieve IND-CCA2 via the Fujisaki–Okamoto / HHK transforms applied to an IND-CPA core.',
	},
	{
		term: 'Lattice (and SVP)',
		def: 'A lattice L ⊂ ℝ^n is the set of integer linear combinations of a basis B. The shortest-vector problem (SVP) asks for the non-zero vector of minimum Euclidean length in L; it is NP-hard in the worst case.',
	},
	{
		term: 'LWE / Module-LWE',
		def: 'Learning With Errors: distinguishing (A, As + e) from uniform, where A is a uniform matrix, s a secret vector, and e small noise. Module-LWE replaces vectors with elements of R_q = ℤ_q[x] / (x^n + 1) for efficiency.',
	},
	{
		term: 'NTRU',
		def: 'A 1996 lattice scheme by Hoffstein–Pipher–Silverman whose ring structure underpins Falcon. Public key is h = f^(-1) · g mod (x^n + 1, q) for small f, g; recovering (f, g) is a structured-lattice problem.',
	},
	{
		term: 'Goppa code / MDPC',
		def: 'Goppa codes are an algebraic family with very efficient bounded-distance decoding; the basis of Classic McEliece. MDPC (Moderate-Density Parity-Check) codes are sparser and underpin BIKE.',
	},
	{
		term: 'Syndrome decoding',
		def: 'Given parity-check matrix H and syndrome s, find low-weight e with He^T = s. NP-complete for general linear codes (Berlekamp–McEliece–Tilborg, 1978).',
	},
	{
		term: 'MQ problem',
		def: 'Solve a system of m quadratic polynomials in n variables over a finite field. NP-complete; the basis of multivariate cryptography.',
	},
	{
		term: 'Isogeny / supersingular curve',
		def: 'An isogeny is a non-zero morphism φ: E_1 → E_2 between elliptic curves that respects the group law. "Supersingular" curves have a particularly rich endomorphism ring; their isogeny graph is the playground of SIKE / CSIDH / SQIsign.',
	},
	{
		term: 'Shor’s algorithm',
		def: 'Peter Shor (1994): polynomial-time quantum algorithms for integer factoring and discrete logarithms. Breaks RSA, Diffie–Hellman, and ECC once large fault-tolerant quantum hardware exists.',
	},
	{
		term: 'Grover’s algorithm',
		def: 'A quadratic quantum speedup for unstructured search. Halves the effective bit security of symmetric primitives — the reason AES-256 and SHA-384 stay on the recommended list.',
	},
	{
		term: 'Hybrid (in PQ deployment)',
		def: 'Combining a classical scheme (X25519, ECDSA) with a PQC scheme so the joint construction is secure as long as *either* component is. Current TLS PQ deployments are almost all hybrid.',
	},
	{
		term: 'Harvest now, decrypt later',
		def: 'An adversary records encrypted traffic today and waits for a sufficiently large quantum computer to decrypt it. The reason migration is happening before that hardware exists.',
	},
	{
		term: 'NIST PQC rounds & FIPS 203/204/205',
		def: 'NIST’s post-quantum standardisation ran four rounds (2016–2024). FIPS 203 = ML-KEM (Kyber). FIPS 204 = ML-DSA (Dilithium). FIPS 205 = SLH-DSA (SPHINCS+). Falcon is being standardised as FIPS 206 / FN-DSA; HQC was selected in 2025; additional signatures are being evaluated in an on-ramp.',
	},
];
