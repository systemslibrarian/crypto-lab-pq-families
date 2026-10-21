# crypto-lab-pq-families

## What It Is

A high-level, interactive overview of the five major post-quantum cryptography (PQC) families: lattice-based, code-based, hash-based, multivariate, and isogeny-based. Where the rest of the crypto-lab portfolio drills into individual schemes, this demo zooms out to compare the families against one another — their underlying hard problems, representative schemes, public-key and signature sizes, NIST standardisation status, and the tradeoffs that decided which families won the first round of standardisation. Two of the five families shown here (multivariate's Rainbow and isogeny's SIKE) were broken in practice in 2022, which is exactly why a comparative view matters: "post-quantum" is a moving target, not a finish line. Everything runs client-side with no dependencies; the comparison corpus lives in a single typed data module.

## When to Use It

- **Teaching or briefing on PQC** — a one-screen map of the whole landscape before diving into any single algorithm.
- **Choosing a family for a migration** — compare key sizes, what each family provides (KEM vs signature), and maturity at a glance.
- **Understanding why lattices won** — see the balance of size, speed, and versatility that made ML-KEM and ML-DSA NIST's primary picks.
- **Explaining algorithmic diversity** — show why code-based and hash-based schemes exist as conservative backups even though lattices lead.
- **Do NOT use these figures for production parameter selection** — sizes are representative and rounded for teaching; consult the relevant FIPS or specification and a vetted library.

## Live Demo

**[systemslibrarian.github.io/crypto-lab-pq-families](https://systemslibrarian.github.io/crypto-lab-pq-families/)**

Select any of the five families to see its hard problem, strengths and weaknesses, a standardisation-confidence meter, and representative schemes with their key and output sizes. The **Handshake Bytes** calculator lets you mix any KEM with any signature (and toggle a classical hybrid hedge) to see the bytes a single TLS 1.3 handshake spends, side-by-side with the X25519+ECDSA baseline; one-click presets (NIST primaries, Hybrid migration, Code/hash diversity, Compact, Broken combo) make the tradeoffs immediately visible. A log-scale **Sizes Across Families** chart switches between public key, secret key, and ciphertext/signature axes. A **What Should You Use?** wizard takes two questions (need + priority) and returns a recommended stack with rationale and a one-click "Try this in the calculator" button. A Head-to-Head table puts all five families on one row, and a vertical **timeline** includes the 2026 Classic McEliece structural preprint alongside earlier breaks and standards. URL hashes deep-link to a specific family (`#family=lattice`), and a warning banner appears whenever you select a family whose flagship scheme has been broken in practice.

**Deployment guidance (October 1, 2026):** [BSI](https://www.bsi.bund.de/DE/Service-Navi/Presse/Alle-Meldungen-News/Meldungen/2026/Classic-McEliece_261001.html) advises against using Classic McEliece in new developments or when planning new cryptographic applications. BSI states that its recommended parameter sets are not currently subject to a practical attack. This is deployment guidance following structural cryptanalysis, not an ISO withdrawal or a change to NIST’s 2025 decision. Earlier TR-02102-1 recommendations were limited to hybrid use.

## Research note — 16 October 2026 revision

[Zhang, Zhou and Qu, ePrint 2026/607](https://eprint.iacr.org/2026/607), a revision of TCHES 2026 research, correct and refine MSIS security estimates for Dilithium. They report costs 3.65–6.09 bits below their conservative Core-SVP baseline. This is model-dependent extrapolation supported by lattice experiments, not demonstrated production-key recovery. The visible lattice attacks and references include this note. FIPS 204 categories remain unchanged; the reported difference must not be subtracted from unrelated estimates. This lab does not execute the research attack.

## What Can Go Wrong


- **Deterministic-CSIDH fault research — 20 October 2026.** Deterministic execution can make the same secret-dependent step easier to target repeatedly. Banegas, Dimitrova and Trimoska study fault attacks on deterministic CSIDH variants and OSIDH-LD. They recover full OSIDH-LD keys in software fault simulation and separately demonstrate a targeted instruction skip on ChipWhisperer-Lite hardware. This is not complete hardware key recovery or a public-key-only mathematical break of CSIDH. The result requires targeted fault injection and output observations; it is distinct from the SIDH/SIKE mathematical break. [Banegas, Dimitrova and Trimoska, *From if to Oops: Turning a conditional into a key-recovery oracle*, ePrint 2026/2542](https://eprint.iacr.org/2026/2542), received 19 October and approved 20 October 2026. **Preprint; attack-model-conditional.** This lab does not implement the attacked variants or reproduce the fault experiment.

- **Mathematical hardness does not prevent implementation leakage.** [Kim et al., *Power Analysis on SQIsign via Ideal Reconstruction from Quaternion Leakages* (ePrint 2026/2508)](https://eprint.iacr.org/2026/2508), received 16 October and published 17 October 2026, is a **preprint** reporting key recovery from leaked intermediate values in Round-3 SQIsign signing, including partial leakage. The result is **attack-model-conditional**: it does not establish a public-key-only mathematical break of SQIsign or a break of CSIDH. This lab does not implement SQIsign or reproduce the reported power analysis.
- **Confusing implementation leakage with a broken lattice assumption** — [Zhou et al. (ePrint 2026/2124, September 22, 2026)](https://eprint.iacr.org/2026/2124) report Falcon power-trace key recovery on PQClean/ARM Cortex-M4; [Jahandideh (ePrint 2026/2137, September 22, 2026)](https://eprint.iacr.org/2026/2137) studies one-trace ML-KEM key-generation leakage on optimized Cortex-M4. These target-specific results do not change FIPS 203's final status or show a generic mathematical break.
- **Treating "post-quantum" as permanent** — Rainbow (multivariate) and SIKE (isogeny) were both broken in 2022; selecting a family on reputation alone is risky, which is why NIST standardised a diverse portfolio.
- **Assuming age rules out structural cryptanalysis** — Classic McEliece has no demonstrated practical production break, but [Weis (ePrint 2026/1984; version 0.5; revised October 6, 2026)](https://eprint.iacr.org/2026/1984) estimates key recovery below generic ISD costs for its candidate sets under explicit heuristics. Its public keys also measure hundreds of kilobytes, which can be prohibitive for constrained protocols.
- **Confusing what a family provides** — hash-based schemes do signatures only and cannot perform key exchange; picking a family without checking KEM-vs-signature support is a common early mistake.
- **Reusing state in stateful hash-based signatures** — LMS and XMSS fail catastrophically if signing state is ever reused, a failure mode absent from the stateless SLH-DSA.
- **Skipping hybrids during migration** — deploying a young PQC scheme alone, rather than combining it with a classical algorithm, removes the safety net if the PQC scheme is later weakened.

## Real-World Usage

- **NIST FIPS 203 / 204 / 205** — the finalised standards for ML-KEM (Kyber), ML-DSA (Dilithium), and SLH-DSA (SPHINCS+), drawn from the lattice and hash-based families compared here.
- **HQC selection (2025)** — NIST's choice of a code-based KEM as an algorithmically diverse backup to lattice-based ML-KEM.
- **Hybrid TLS key exchange** — widespread deployments pairing X25519 with ML-KEM-768 so a connection stays secure as long as either component holds.
- **liboqs / Open Quantum Safe** — the reference open-source library implementing schemes across these families for experimentation and integration.
- **Harvest-now-decrypt-later mitigation** — organisations migrating long-lived secrets to PQC today, before large-scale quantum computers exist, because recorded ciphertext can be decrypted retroactively.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-pq-families
cd crypto-lab-pq-families
npm install
npm run dev
```

## Related Demos
- [crypto-lab-kyber-vault](https://systemslibrarian.github.io/crypto-lab-kyber-vault/) — ML-KEM (FIPS 203), the flagship of the lattice family compared here.
- [crypto-lab-dilithium-seal](https://systemslibrarian.github.io/crypto-lab-dilithium-seal/) — ML-DSA (FIPS 204), the lattice-based signature scheme.
- [crypto-lab-sphincs-ledger](https://systemslibrarian.github.io/crypto-lab-sphincs-ledger/) — SLH-DSA (FIPS 205), the stateless hash-based signature family.
- [crypto-lab-mceliece-gate](https://systemslibrarian.github.io/crypto-lab-mceliece-gate/) — Classic McEliece, a code-based KEM with evolving structural-attack estimates.
- [crypto-lab-hybrid-guide](https://systemslibrarian.github.io/crypto-lab-hybrid-guide/) — KEM combiners (X-Wing) for pairing classical and PQ primitives during migration.

## For Cryptographers and Students

The lab includes five live, in-browser learning tools — every byte computed locally, no servers, no telemetry:

- **Live Lamport one-time signature demo** — Generate a real 16 KB Lamport keypair using the browser's `crypto.subtle.digest('SHA-256', …)`. Sign any message you type, watch the 256-cell digest grid colour in by which key-half each bit reveals, then click **Tamper & verify** to see the verification fail. This is real working cryptography (1979 Lamport, the construction underneath SLH-DSA / SPHINCS+'s leaves). Open DevTools — the bytes are real.
- **Key reuse, mounted rather than described** — **Sign a second message** with the same keypair and the page counts, from the two digests it just computed, exactly how many of the 256 positions now leak *both* private halves (the outlined cells), how many remain one-sided, and what that does to the forgery grind — typically from 2²⁵⁶ down to about 2¹²⁸. That is still far out of reach of a browser tab, so a second panel runs the *same* `lamportKeygen` / `lamportSign` / `lamportVerify` functions over a **deliberately truncated 12 / 16 / 20-bit digest**, where the grind finishes in a few hundred hashes: two signatures are published, the leaked halves are assembled, candidate messages are hashed until one is covered, and the forged signature is handed to the real verifier, which accepts it. The scale is a toy and is labelled as one on the page; nothing about the attack is simulated. A control step then takes a message the leak does *not* cover, fills the missing positions with the only halves the attacker holds, and the same verifier rejects it.
- **2D lattice visualizer** — drag the basis vectors b₁ and b₂; the demo redraws every integer-combination lattice point, the fundamental parallelogram, and the shortest non-zero lattice vector in real time. Lagrange–Gauss reduction runs **as a visible sequence**: step once, or run to the fixed point, and every iteration prints what it actually did — whether it swapped b₁ and b₂, the integer μ = ⌊⟨b₁,b₂⟩/⟨b₁,b₁⟩⌉ it rounded to, the norm b₂ fell to, and the resulting orthogonality defect — until μ comes out 0. A *Parallel (not a lattice)* preset shows the honest failure: a rank-1 pair reduces to the zero vector, and the trace says the input spans a line instead of presenting (0, 0) as a shortest vector. Numerical readout includes ‖b₁‖·‖b₂‖, det L, and the orthogonality defect — so "what changes between a good and a bad basis" is something you can *feel*.
- **Prange ISD work calculator** — sliders for code parameters (n, k, t) with live log₂-bits computation using the C(n, t) / C(n−k, t) ratio. Presets for three Classic McEliece parameter sets illustrate generic decoding work. This calculator models neither modern ISD nor the 2026 structural key-recovery estimate, and its output is **not** an overall security level or standardization analysis.
- **Handshake bytes calculator** — already covered above, but now with a **0 / 1 / 2 intermediate cert** toggle so the compounding cost of long PQC certificate chains is visible (each ML-DSA intermediate adds ~5 KB). Selecting a dead scheme — the **Broken combo** preset picks SIKEp434 and Rainbow (Ia) — opens a hand-off panel naming the cryptanalysis that ended it, quoted from this repo's own attack list, and links through to the sibling lab that actually runs the mathematics: [crypto-lab-isogeny-gate](https://systemslibrarian.github.io/crypto-lab-isogeny-gate/) for Castryck–Decru, [crypto-lab-multivariate](https://systemslibrarian.github.io/crypto-lab-multivariate/) for Beullens on Rainbow. This page can price a broken scheme's bytes; it cannot break it, and says so.

Every family panel additionally includes:

- A **formal hard-problem statement** in symbols (Module-LWE, syndrome decoding, MQ, supersingular isogeny problem) plus a "reduces from" note explaining the hardness pedigree.
- Each representative scheme tagged with its **NIST PQC security category** (1 / 2 / 3 / 5) and a one-line **performance note** so size, speed, and security level are visible together.
- A **Notable cryptanalysis** timeline per family — Prange ISD, BKZ, KyberSlash, MDPC decoding-failure, Patarin / Kipnis–Shamir / Beullens, Castryck–Decru, Kuperberg — each with year and one-line summary.
- **Further reading** with canonical citations (Regev 2005, McEliece 1978, Patarin 1997, Jao–De Feo 2011, Bernstein et al., Beullens 2022, Castryck–Decru 2022) and stable links (FIPS 203 / 204 / 205, RFC 8391, RFC 8554, IACR project pages).
- A **NIST categories** tab explaining the effort floors (Cat 1 ≈ AES-128, Cat 3 ≈ AES-192, Cat 5 ≈ AES-256), a **dated RSA-2048 resource comparison** inside the Shor context tab: Gidney–Ekerå’s 2019 preprint / 2021 publication (~20M noisy physical qubits, ~8 h) alongside [Gidney’s 21 May 2025 preprint](https://arxiv.org/abs/2505.15917v1) (~1M physical qubits with slack, less than one week). The comparison keeps 1,409 active logical qubits separate from 1,537 including idle hot patches, records the hardware assumptions, and makes no Q-Day forecast, a real-world **implementation status table** mapping each scheme to its support in liboqs / OpenSSL / BoringSSL / BouncyCastle / CIRCL / RustCrypto, and a **glossary** at the bottom with one-line definitions of every term used (KEM, LWE, NTRU, Goppa code, MDPC, MQ, isogeny, Grover, IND-CCA2, hybrid, harvest-now-decrypt-later, FIPS rounds).

The isogeny Math pane distinguishes the [Delfs–Galbraith](https://arxiv.org/abs/1310.7789v1) full-graph Õ(p^(1/2)) discussion from its special F_p Õ(p^(1/4)) algorithm. Both are exponential in input bit length n = log₂(p); the special-case bound is not a generic supersingular bound. The [Childs–Jao–Soukharev](https://arxiv.org/abs/1012.4019v3) GRH-conditioned quantum result concerns ordinary horizontally isogenous curves and a class-group action, not unrestricted supersingular path finding. This is a comparison of those cited scopes, not a complete current algorithm survey.

## Tech

Vite + TypeScript, zero runtime dependencies. The comparison corpus, history timeline, and classical baseline live in a single typed module (`src/data.ts`); the UI is plain DOM in `src/ui.ts`. Dark mode throughout, log-scale charts with a metric switch, an interactive handshake-bytes visualiser, URL deep-linking, and number-key shortcuts. WAI-ARIA tablists with keyboard navigation throughout.

All of the mathematics — Lamport keygen/sign/verify, the leak and forgery machinery, the Prange
ratio, and Lagrange–Gauss reduction — lives in `src/crypto.ts` as pure functions, so the unit tests
and the page run the identical code. Gates:

```
npm run test      # vitest: SHA-256 KATs, Lamport round-trips and forgeries, ISD, reduction traces
npm run build     # tsc --noEmit + vite build
npm run test:a11y # playwright: e2e/a11y.spec.ts (axe, both themes) + e2e/demo.spec.ts (behaviour)
```

`e2e/demo.spec.ts` asserts the computed outcome of each exhibit *and* its failure path: the tampered
message is rejected, the leaked-both count equals the differing-bit count, the toy forgery is accepted
by the real verifier while the uncovered control is refused, each McEliece preset lands in the category
its binomial ratio implies, and the parallel basis is reported as not a lattice.

---

*Part of the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*

