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

[**https://systemslibrarian.github.io/crypto-lab-pq-families/**](https://systemslibrarian.github.io/crypto-lab-pq-families/)

Select any of the five families to see its hard problem, strengths and weaknesses, a standardisation-confidence meter, and representative schemes with their key and output sizes. A log-scale Public Key Sizes chart makes the McEliece-vs-everything-else tradeoff visible at a glance, a Head to Head table puts all five families on one row, and a Bigger Picture panel covers Shor's algorithm, harvest-now-decrypt-later, why lattices won, and hybrid deployment. A warning banner appears whenever you select a family whose flagship scheme has been broken.

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

## Tech

Vite + TypeScript, zero runtime dependencies. The comparison corpus is a single typed module (`src/data.ts`); the UI is plain DOM in `src/ui.ts`. Dark mode by default with a persisted theme toggle.

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
```

---

"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31
