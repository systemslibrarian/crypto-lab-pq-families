import { describe, it, expect } from 'vitest';
import {
	CLASSICAL_BASELINE,
	FAMILIES,
	GLOSSARY,
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

	// HQC team's October 12, 2026 specification, Table 9. Unlike the 2025
	// expanded key, the 32-byte seed is now the default decapsulation key.
	it('HQC-1 uses the 2026 specification and selected status', () => {
		const s = findScheme('HQC-128');
		expect(s.maturity).toBe('selected');
		expect(s.pubKey).toBe(2241);
		expect(s.secretKey).toBe(32);
		expect(s.output).toBe(4433);
		expect(s.note).toMatch(/compressed decapsulation key \(now the default/);
	});

	// SQIsign specification version 3.0 (1 September 2026, the Round-3 submission),
	// Table 12: NIST-I is 83 / 270 / 200 bytes. The row previously carried the
	// Round-1 figures (64 / 16 / 177), which no current specification prints.
	it('SQIsign level I matches the Round-3 specification', () => {
		const s = findScheme('SQIsign');
		expect(s.standard).toMatch(/Round 3/);
		expect(s.pubKey).toBe(83);
		expect(s.secretKey).toBe(270);
		expect(s.output).toBe(200); // signature
	});

	// uov-Ip (n, m, q) = (119, 45, 256) in the Round-3 specification (version 3.0,
	// 30 August 2026) Table 1, so v = n - m = 74 and the expanded secret key
	// esk = (seed_sk, O, {Pi(1), Si}) measures
	//   32 + 74*45 + 45*(74*75/2) + 45*(74*45)
	//   = 32 + 3,330 + 124,875 + 149,850 = 278,087 B,
	// which is the figure in that table's |esk| column. The arithmetic is the
	// check: a size typed in from a table can be mistyped, one derived from the
	// parameter set cannot disagree with it silently. Round 2 was (112, 44) and
	// 237,896 B by the same formula.
	it('uov-Ip expanded secret key agrees with the size formula', () => {
		const v = 119 - 45;
		const m = 45;
		const esk = 32 + v * m + m * ((v * (v + 1)) / 2) + m * (v * m);
		expect(esk).toBe(278087);
		expect(findScheme('UOV (uov-Ip)').secretKey).toBe(esk);
		// The expanded public key is the same arithmetic over n: m * n(n+1)/2.
		expect(findScheme('UOV (uov-Ip)').pubKey).toBe(m * ((119 * 120) / 2));
		expect(findScheme('UOV (uov-Ip)').pubKey).toBe(321300);
	});

	// The round label and the numbers have to travel together, which is the only
	// thing this pins -- not which round. The row carried Round-2 figures under a
	// "Round 2" label until 2026-11-18 and now carries Round-3 figures under a
	// "Round 3" one; labelling it "Round 3" while printing (112, 44) sizes is the
	// drift this exists to catch, and so is the reverse. The note must still say
	// UOV is a live Round-3 candidate and must still record what Round 2 gave, so
	// a reader meeting the old numbers elsewhere can place them.
	it('the UOV row labels the round its sizes come from', () => {
		const s = findScheme('UOV (uov-Ip)');
		expect(s.standard).toBe('Additional-signature Round 3 sizes');
		expect(s.pubKey).toBe(321300);
		expect(s.output).toBe(135); // signature
		expect(s.note).toMatch(/Round-3 specification \(version 3\.0, 30 August 2026\)/);
		expect(s.note).toMatch(/\(112, 44\) with 278,432 \/ 237,896 \/ 128 B/);
		expect(s.note).toMatch(/still in NIST\u2019s additional-signature Round 3/);
		expect(s.note).toMatch(/\(119, 45\)/);
		expect(s.note).toMatch(/321,300 B/);
		expect(s.note).toMatch(/278,087 B/);
		expect(s.note).toMatch(/135 B/);
		// SQIsign's row, by contrast, does print its Round-3 specification sizes.
		expect(findScheme('SQIsign').standard).toBe('Additional-signature Round 3 candidate');
	});

	it('the UOV source card identifies the linked Round-3 specification', () => {
		const multivariate = FAMILIES.find((f) => f.id === 'multivariate')!;
		const source = multivariate.references.find((r) => r.url?.endsWith('UOV_Specification_R3.pdf'))!;
		expect(source.year).toBe(2026);
		expect(source.title).toMatch(/specification version 3\.0/);
		expect(source.venue).toMatch(/Round 3 submission, 30 August 2026/);
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

it('keeps family maturity distinct from broken individual schemes', () => {
	const code = FAMILIES.find((f) => f.id === 'code')!;
	const multivariate = FAMILIES.find((f) => f.id === 'multivariate')!;
	const isogeny = FAMILIES.find((f) => f.id === 'isogeny')!;
	expect(code.maturity).toBe('selected');
	expect(multivariate.maturity).toBe('research');
	expect(isogeny.maturity).toBe('research');
	expect(findScheme('Rainbow (Ia)').maturity).toBe('broken');
	expect(findScheme('SIKEp434').maturity).toBe('broken');
	expect(findScheme('UOV (uov-Ip)').maturity).toBe('research');
	expect(findScheme('SQIsign').maturity).toBe('research');
	expect(code.references.some((r) => r.url === 'https://pqc-hqc.org/doc/hqc_specifications_2026_10_12.pdf')).toBe(true);
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

// =====================================================================
// Statements checked against their primary sources on 15 November 2026. Each of
// these shipped a figure or a citation that the source contradicts, so each one
// gets an assertion rather than a second chance to drift.
// =====================================================================
describe('figures agree with the prose beside them', () => {
	// ~150M cycles is about 0.05 s at 3 GHz. "Takes seconds" was off by ~20x
	// against the cycle count printed directly under it.
	it('Classic McEliece key generation is milliseconds, not seconds', () => {
		const s = findScheme('Classic McEliece 348864');
		expect(s.cyclesNote).toMatch(/150M/);
		expect(s.performance).toMatch(/tens of milliseconds/);
		expect(s.performance).not.toMatch(/takes seconds/);
	});

	// The Kyber team's own table (pq-crystals.org/kyber): Kyber-768 AVX2 on an
	// Intel Core-i7 4770K (Haswell) is 52,732 / 67,624 / 53,156 cycles. The
	// previous 14k / 17k / 21k had no source and named the wrong platform.
	it('ML-KEM-768 cycle counts name the Kyber team AVX2 table and its platform', () => {
		const s = findScheme('ML-KEM-768 (Kyber)');
		expect(s.cyclesNote).toMatch(/53k/);
		expect(s.cyclesNote).toMatch(/68k/);
		expect(s.cyclesNote).toMatch(/Haswell/);
		expect(s.cyclesNote).not.toMatch(/14k|Skylake/);
	});
});

describe('attributions name the right paper and venue', () => {
	// ePrint 2022/214 calls its own result the simple attack (section 3) and
	// credits the rectangular MinRank attack to ePrint 2020/1343 (Eurocrypt 2021).
	it('Rainbow\u2019s weekend break is the simple attack, not rectangular MinRank', () => {
		const multivariate = FAMILIES.find((f) => f.id === 'multivariate')!;
		const rainbow = findScheme('Rainbow (Ia)');
		expect(rainbow.note).toMatch(/simple attack/);
		expect(rainbow.note).not.toMatch(/rectangular MinRank/);

		const attack = multivariate.attacks.find((a) => a.name.includes('Beullens'))!;
		expect(attack.summary).toMatch(/simple attack/);
		expect(attack.summary).toMatch(/earlier 2021 result/);
	});

	// IACR TCHES 2025(2):209-234, doi:10.46586/tches.v2025.i2.209-234.
	it('KyberSlash cites its TCHES 2025 publication', () => {
		const lattice = FAMILIES.find((f) => f.id === 'lattice')!;
		const kyberslash = lattice.attacks.find((a) => a.name === 'KyberSlash')!;
		expect(kyberslash.venue).toMatch(/TCHES 2025\(2\):209/);
		expect(kyberslash.venue).not.toMatch(/no peer-reviewed venue/);
	});

	// ePrint 2013/506 is Rauzy and Guilley on CRT-RSA fault countermeasures. The
	// Delfs-Galbraith preprint is arXiv:1310.7789, which Sources already links.
	it('Delfs\u2013Galbraith cites the arXiv preprint, not ePrint 2013/506', () => {
		const isogeny = FAMILIES.find((f) => f.id === 'isogeny')!;
		const dg = isogeny.attacks.find((a) => a.name.includes('Delfs'))!;
		expect(dg.summary).toMatch(/arXiv:1310\.7789/);
		expect(dg.summary).not.toMatch(/2013\/506/);
		expect(
			isogeny.references.some((r) => r.url?.includes('1310.7789')),
		).toBe(true);
	});

	// IACR CryptoDB lists "Mitigating Multi-target Attacks in Hash-Based
	// Signatures" (Hulsing, Rijneveld, Song) in the PKC 2016 program; the preprint
	// is ePrint 2015/1256. The entry was dated 2020, which is no edition of it.
	it('the multi-target analysis is dated to its PKC 2016 venue', () => {
		const hash = FAMILIES.find((f) => f.id === 'hash')!;
		const attack = hash.attacks.find((a) => a.name === 'WOTS+ multi-target analysis')!;
		expect(attack.year).toBe(2016);
		expect(attack.venue).toMatch(/PKC 2016/);
		expect(
			hash.references.some((r) => r.year === 2016 && r.url === 'https://eprint.iacr.org/2015/1256'),
		).toBe(true);
	});

	// NIST IR 8545, released March 2025, closed the fourth round by selecting HQC.
	it('the glossary dates the four rounds to 2016-2025', () => {
		const entry = GLOSSARY.find((g) => g.term.includes('NIST PQC rounds'))!;
		expect(entry.def).toMatch(/2016\u20132025/);
		expect(entry.def).not.toMatch(/2016\u20132024/);
	});
});

// =====================================================================
// Standards reviewed 15 November 2026 — the additional-signatures Round 3 and
// the SQIsign performance figures. Both are claims rather than computed values,
// so these assertions are the only thing that can catch them drifting back.
// =====================================================================
describe('additional-signature Round 3 is dated to its primary source', () => {
	// NIST IR 8610 (May 2026), "Status Report on the Second Round of the
	// Additional Digital Signature Schemes": "The second round began on
	// October 24, 2024, and continued until May 14, 2026", and NIST "selected
	// nine candidate algorithms to move forward to the third round". Every place
	// this lab gives a scheme's CURRENT status has to carry that date, because
	// "Round 3" alone has meant three different things over three years.
	it('every current-status statement names 14 May 2026 and NIST IR 8610', () => {
		const multivariate = FAMILIES.find((f) => f.id === 'multivariate')!;
		const isogeny = FAMILIES.find((f) => f.id === 'isogeny')!;
		for (const text of [
			multivariate.summary,
			isogeny.summary,
			findScheme('UOV (uov-Ip)').note!,
			findScheme('SQIsign').note!,
			GLOSSARY.find((g) => g.term.includes('NIST PQC rounds'))!.def,
		]) {
			expect(text).toMatch(/14 May 2026/);
			expect(text).toMatch(/IR 8610/);
		}
	});

	it('cites IR 8610 itself in both families that have a Round-3 candidate', () => {
		for (const id of ['multivariate', 'isogeny']) {
			const fam = FAMILIES.find((f) => f.id === id)!;
			expect(fam.references.some((r) => r.url === 'https://doi.org/10.6028/NIST.IR.8610')).toBe(true);
		}
	});

	// The label and the parameter set move together or not at all. This used to
	// pin the Round-2 label while Round 3 was only a date in the prose; the sizes
	// have since moved, so it pins the agreement rather than the round: whatever
	// the label says, the public key must be the size that label's own Table 1
	// gives.
	it('the UOV label and its parameter set agree', () => {
		const s = findScheme('UOV (uov-Ip)');
		const byRound: Record<string, number> = {
			'Additional-signature Round 2 sizes': 278432,
			'Additional-signature Round 3 sizes': 321300,
		};
		expect(Object.keys(byRound)).toContain(s.standard);
		expect(s.pubKey).toBe(byRound[s.standard]);
	});
});

describe('SQIsign timings come from the current specification', () => {
	// SQIsign specification version 3.0 (1 September 2026, the Round-3
	// submission), Table 13, "SQIsign performance in 10^6 CPU cycles on an Intel
	// Core i7-13700K CPU. Results are the median of 1,000 benchmark runs."
	// Assembly-optimized for Intel Broadwell or later, NIST-I: 32.2 / 93.9 / 12.1.
	// Section 1.1 gives the wall clock itself: "about 27.6 ms for signing and
	// 3.6 ms for verification on an Intel Core i7-13700K". The row used to print
	// "keygen ~1B . sign ~2B . verify ~50M cycles (early ref impl, Skylake)" and
	// "signing ~ seconds", which no current specification contains.
	it('prints Table 13 NIST-I cycles with the platform the spec names', () => {
		const s = findScheme('SQIsign');
		expect(s.cyclesNote).toMatch(/32\.2/);
		expect(s.cyclesNote).toMatch(/93\.9/);
		expect(s.cyclesNote).toMatch(/12\.1/);
		expect(s.cyclesNote).toMatch(/i7-13700K/);
		expect(s.cyclesNote).toMatch(/v3\.0 Table 13/);
		// The stale strings, and the round-1/round-2 comparison figures from
		// section 1.3, must not come back in their place.
		expect(s.cyclesNote).not.toMatch(/Skylake/);
		expect(s.cyclesNote).not.toMatch(/1B|2B|50M/);
		expect(s.cyclesNote).not.toMatch(/103\.0|5\.1/);
	});

	it('quotes the specification wall clock instead of "seconds"', () => {
		const s = findScheme('SQIsign');
		expect(s.performance).toMatch(/27\.6 ms/);
		expect(s.performance).toMatch(/3\.6 ms/);
		expect(s.performance).toMatch(/i7-13700K/);
		expect(s.performance).not.toMatch(/\u2248 seconds/);
	});

	it('names the version 3.0 specification as the source of the row', () => {
		const isogeny = FAMILIES.find((f) => f.id === 'isogeny')!;
		expect(
			isogeny.references.some((r) => r.url === 'https://sqisign.org/spec/sqisign-20260901.pdf'),
		).toBe(true);
	});
});
