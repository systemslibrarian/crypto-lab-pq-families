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

Select any of the five families to see its hard problem, strengths and weaknesses, a standardisation-confidence meter, and representative schemes with their key and output sizes. The **Handshake Bytes** calculator lets you mix any KEM with any signature (and toggle a classical hybrid hedge) to see the bytes a single TLS 1.3 handshake spends, side-by-side with the X25519+ECDSA baseline; one-click presets (NIST primaries, Hybrid migration, Conservative, Compact, Broken combo) make the tradeoffs immediately visible. A log-scale **Sizes Across Families** chart switches between public key, secret key, and ciphertext/signature axes. A **What Should You Use?** wizard takes two questions (need + priority) and returns a recommended stack with rationale and a one-click "Try this in the calculator" button. A Head-to-Head table puts all five families on one row, a vertical **timeline** walks from McEliece (1978) through Shor (1994), the 2022 breaks, and the FIPS standards of 2024–2025, and a Bigger Picture panel covers Shor's algorithm, harvest-now-decrypt-later, why lattices won, and hybrid deployment. URL hashes deep-link to a specific family (`#family=lattice`), a copy-link button shares the current view, sections fade in as they scroll into view (motion-respecting), and number keys `1`–`5` jump between families. A warning banner appears whenever you select a family whose flagship scheme has been broken.

## What Can Go Wrong

- **Treating "post-quantum" as permanent** — Rainbow (multivariate) and SIKE (isogeny) were both broken in 2022; selecting a family on reputation alone is risky, which is why NIST standardised a diverse portfolio.
- **Ignoring key-size constraints** — Classic McEliece offers maximal conservatism but with public keys of hundreds of kilobytes, which can be prohibitive for constrained protocols or embedded devices.
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
- [crypto-lab-mceliece-gate](https://systemslibrarian.github.io/crypto-lab-mceliece-gate/) — Classic McEliece, the conservative code-based KEM.
- [crypto-lab-hybrid-guide](https://systemslibrarian.github.io/crypto-lab-hybrid-guide/) — KEM combiners (X-Wing) for pairing classical and PQ primitives during migration.

## For Cryptographers and Students

The lab includes four live, in-browser learning tools — every byte computed locally, no servers, no telemetry:

- **Live Lamport one-time signature demo** — Generate a real 16 KB Lamport keypair using the browser's `crypto.subtle.digest('SHA-256', …)`. Sign any message you type, watch the 256-cell digest grid colour in by which key-half each bit reveals, then click **Tamper & verify** to see the verification fail. This is real working cryptography (1979 Lamport, the construction underneath SLH-DSA / SPHINCS+'s leaves). Open DevTools — the bytes are real.
- **2D lattice visualizer** — drag the basis vectors b₁ and b₂; the demo redraws every integer-combination lattice point, the fundamental parallelogram, and the shortest non-zero lattice vector in real time. One click runs a Lagrange–Gauss reduction step. Numerical readout includes ‖b₁‖·‖b₂‖, det L, and the orthogonality defect — so "what changes between a good and a bad basis" is something you can *feel*.
- **Prange ISD work calculator** — sliders for code parameters (n, k, t) with live log₂-bits computation using the C(n, t) / C(n−k, t) ratio. Preset buttons for the three Classic McEliece parameter sets (348864, 460896, 6688128) show where *raw* Prange lands relative to the NIST Cat 1 / 3 / 5 floors. Textbook Prange (1962) is the weakest ISD, so for the default set it sits right at the Cat-1 floor (~143 bits) and for the higher sets slightly below their nominal floors; the parameter sets carry their real margin against the *best-known* ISD variants, which this simple ratio does not model. It is an order-of-magnitude teaching tool, not the standardisation analysis.
- **Handshake bytes calculator** — already covered above, but now with a **0 / 1 / 2 intermediate cert** toggle so the compounding cost of long PQC certificate chains is visible (each ML-DSA intermediate adds ~5 KB).

Every family panel additionally includes:

- A **formal hard-problem statement** in symbols (Module-LWE, syndrome decoding, MQ, supersingular isogeny problem) plus a "reduces from" note explaining the hardness pedigree.
- Each representative scheme tagged with its **NIST PQC security category** (1 / 2 / 3 / 5) and a one-line **performance note** so size, speed, and security level are visible together.
- A **Notable cryptanalysis** timeline per family — Prange ISD, BKZ, KyberSlash, MDPC decoding-failure, Patarin / Kipnis–Shamir / Beullens, Castryck–Decru, Kuperberg — each with year and one-line summary.
- **Further reading** with canonical citations (Regev 2005, McEliece 1978, Patarin 1997, Jao–De Feo 2011, Bernstein et al., Beullens 2022, Castryck–Decru 2022) and stable links (FIPS 203 / 204 / 205, RFC 8391, RFC 8554, IACR project pages).
- A **NIST categories** tab explaining the effort floors (Cat 1 ≈ AES-128, Cat 3 ≈ AES-192, Cat 5 ≈ AES-256), a **Shor resource estimate** (Gidney–Ekerå 2019: ~20M noisy qubits, ~8 h runtime for RSA-2048) inside the Shor info panel, a real-world **implementation status table** mapping each scheme to its support in liboqs / OpenSSL / BoringSSL / BouncyCastle / CIRCL / RustCrypto, and a **glossary** at the bottom with one-line definitions of every term used (KEM, LWE, NTRU, Goppa code, MDPC, MQ, isogeny, Grover, IND-CCA2, hybrid, harvest-now-decrypt-later, FIPS rounds).

## Tech

Vite + TypeScript, zero runtime dependencies. The comparison corpus, history timeline, and classical baseline live in a single typed module (`src/data.ts`); the UI is plain DOM in `src/ui.ts`. Dark mode by default with a persisted theme toggle, log-scale charts with a metric switch, an interactive handshake-bytes visualiser, URL deep-linking, and number-key shortcuts. WAI-ARIA tablists with keyboard navigation throughout.

---

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
