// ui.ts — builds and mounts the Post-Quantum Families interactive overview.
import { FAMILIES, MATURITY_LABEL, formatBytes, type Family, type Scheme } from './data.ts';

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	html?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (html !== undefined) node.innerHTML = html;
	return node;
}

// Wire a set of role="tab" buttons into a WAI-ARIA tablist: roving tabindex,
// aria-selected on the active tab, and Left/Right/Home/End keyboard navigation.
function wireTablist(tabs: HTMLButtonElement[], activate: (tab: HTMLButtonElement) => void): void {
	function select(tab: HTMLButtonElement): void {
		tabs.forEach((t) => {
			const isActive = t === tab;
			t.classList.toggle('is-active', isActive);
			t.setAttribute('aria-selected', String(isActive));
			t.tabIndex = isActive ? 0 : -1;
		});
		activate(tab);
	}

	tabs.forEach((tab, i) => {
		tab.setAttribute('aria-selected', 'false');
		tab.tabIndex = -1;
		tab.addEventListener('click', () => select(tab));
		tab.addEventListener('keydown', (e: KeyboardEvent) => {
			const last = tabs.length - 1;
			let next = -1;
			if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = i === last ? 0 : i + 1;
			else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = i === 0 ? last : i - 1;
			else if (e.key === 'Home') next = 0;
			else if (e.key === 'End') next = last;
			if (next === -1) return;
			e.preventDefault();
			select(tabs[next]);
			tabs[next].focus();
		});
	});

	if (tabs.length) select(tabs[0]);
}

function maturityChip(m: Family['maturity']): string {
	const tone =
		m === 'broken'
			? 'scenario-status--invalid'
			: m === 'research'
				? 'scenario-status--pending'
				: 'scenario-status--valid';
	return `<span class="maturity-chip ${tone}">${MATURITY_LABEL[m]}</span>`;
}

function renderHero(): HTMLElement {
	const hero = el('header', 'hero-panel');
	hero.innerHTML = `
    <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Switch theme">\u{1F319}</button>
    <div class="hero-copy">
      <a class="portfolio-badge" href="https://github.com/systemslibrarian?tab=repositories&q=crypto-lab">crypto-lab \u00b7 portfolio</a>
      <p class="eyebrow">Post-Quantum Cryptography</p>
      <h1>PQ Families</h1>
      <p class="hero-text">
        Five mathematical families are competing to secure the post-quantum era. This lab
        compares lattice, code-based, hash-based, multivariate, and isogeny schemes side by
        side \u2014 their hard problems, key and signature sizes, NIST status, and why
        structured lattices won the first round of standardisation.
      </p>
      <details class="why-details">
        <summary>Why does this matter?</summary>
        <p>
          A large-scale quantum computer running Shor\u2019s algorithm would break RSA and
          elliptic-curve cryptography outright. NIST\u2019s response is a portfolio of families
          built on problems believed hard for quantum machines. Two of these families have
          already been broken \u2014 a reminder that \u201Cpost-quantum\u201D is a moving target,
          not a finish line.
        </p>
      </details>
    </div>
    <div class="hero-metric-card">
      <p class="hero-metric-label">NIST standards (2024\u20132025)</p>
      <p class="hero-metric-value">FIPS 203 \u00b7 ML-KEM<br/>FIPS 204 \u00b7 ML-DSA<br/>FIPS 205 \u00b7 SLH-DSA<br/>HQC \u00b7 code-based KEM</p>
      <p class="hero-metric-note">3 of 5 families standing \u00b7 2 broken since 2022</p>
    </div>
  `;
	return hero;
}

// --- Section 1: family explorer -------------------------------------------
function renderExplorer(): HTMLElement {
	const section = el('section', 'lab-section');
	section.setAttribute('aria-labelledby', 'playground-heading');

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Explore</p>
        <h2 id="playground-heading">The Five Families</h2>
        <p class="section-footnote">Select a family to see its hard problem, tradeoffs, and representative schemes.</p>
      </div>
    </div>
    <div class="family-tabs" role="tablist" aria-label="PQC families"></div>
    <div class="family-detail" id="family-detail" role="tabpanel" tabindex="0" aria-live="polite"></div>
    <div class="warning-banner" id="broken-banner" role="status" aria-live="polite" hidden>
      <span aria-hidden="true">\u26A0\uFE0F</span>
      <span id="broken-banner-text"></span>
    </div>
  `;

	const tabs = section.querySelector('.family-tabs') as HTMLElement;
	const detail = section.querySelector('.family-detail') as HTMLElement;
	const banner = section.querySelector('#broken-banner') as HTMLElement;
	const bannerText = section.querySelector('#broken-banner-text') as HTMLElement;

	function paint(family: Family): void {
		const schemeCards = family.schemes
			.map(
				(s: Scheme) => `
        <div class="panel-card">
          <div class="panel-header">
            <h3>${s.name}</h3>
            ${maturityChip(s.maturity)}
          </div>
          <p class="panel-copy"><strong>${s.standard}</strong> \u00b7 ${s.kind}</p>
          <div class="math-summary-grid">
            <div><p class="hero-metric-label">Public key</p><p class="mono-inline">${formatBytes(s.pubKey)}</p></div>
            <div><p class="hero-metric-label">${s.outputLabel}</p><p class="mono-inline">${formatBytes(s.output)}</p></div>
          </div>
          <p class="panel-copy">${s.note}</p>
        </div>`,
			)
			.join('');

		detail.innerHTML = `
      <div class="family-headline">
        <div>
          <h3 class="family-name">${family.name} ${maturityChip(family.maturity)}</h3>
          <p class="panel-copy"><strong>Hard problem:</strong> ${family.hardProblem}</p>
          <p class="panel-copy">${family.basis}</p>
        </div>
        <div class="confidence-meter">
          <p class="hero-metric-label">Standardisation confidence</p>
          <div class="confidence-track"><div class="confidence-fill" style="width:0%"></div></div>
          <p class="mono-inline confidence-value">${family.confidence}/100</p>
        </div>
      </div>
      <p class="panel-copy family-summary">${family.summary}</p>
      <div class="reuse-grid">
        <div class="panel-card">
          <h3>Strengths</h3>
          <ul class="trait-list trait-list--good">${family.strengths.map((s) => `<li>${s}</li>`).join('')}</ul>
        </div>
        <div class="panel-card">
          <h3>Weaknesses</h3>
          <ul class="trait-list trait-list--bad">${family.weaknesses.map((s) => `<li>${s}</li>`).join('')}</ul>
        </div>
      </div>
      <p class="section-kicker" style="margin-top:22px">Representative schemes</p>
      <div class="playground-grid">${schemeCards}</div>
    `;

		// animate confidence bar
		requestAnimationFrame(() => {
			const fill = detail.querySelector('.confidence-fill') as HTMLElement;
			if (fill) fill.style.width = `${family.confidence}%`;
		});

		if (family.maturity === 'broken') {
			banner.hidden = false;
			bannerText.textContent = `${family.name} includes a flagship scheme that has been broken in practice. Shown here for educational and historical value \u2014 do not deploy.`;
		} else {
			banner.hidden = true;
		}
	}

	const tabButtons = FAMILIES.map((family) => {
		const btn = el('button', 'tab-button', `${family.name}`);
		btn.type = 'button';
		btn.id = `family-tab-${family.id}`;
		btn.setAttribute('role', 'tab');
		btn.setAttribute('aria-controls', 'family-detail');
		btn.dataset.id = family.id;
		tabs.appendChild(btn);
		return btn;
	});

	wireTablist(tabButtons, (btn) => {
		const family = FAMILIES.find((f) => f.id === btn.dataset.id)!;
		detail.setAttribute('aria-labelledby', btn.id);
		paint(family);
	});

	return section;
}

// --- Section 2: size comparison -------------------------------------------
function renderSizeChart(): HTMLElement {
	const section = el('section', 'lab-section');

	// gather one representative KEM/Sig per family that has the chosen kind
	const rows = FAMILIES.flatMap((f) =>
		f.schemes.map((s) => ({ family: f.name, fid: f.id, ...s })),
	);
	// Log scale: keys span 32 B to ~261 KB, so a linear bar would crush everything
	// except McEliece into a sliver. Map log2(bytes) across the min..max range.
	const logs = rows.map((r) => Math.log2(r.pubKey));
	const minLog = Math.min(...logs);
	const maxLog = Math.max(...logs);

	const bars = rows
		.map((r) => {
			const norm = (Math.log2(r.pubKey) - minLog) / (maxLog - minLog);
			const pct = Math.max(4, 4 + norm * 96);
			return `
      <div class="size-row">
        <div class="size-label">
          <span class="size-name">${r.name}</span>
          <span class="size-fam">${r.family} \u00b7 ${r.kind}</span>
        </div>
        <div class="size-track">
          <div class="size-fill size-fill--${r.fid}" style="width:0%" data-target="${pct}"></div>
        </div>
        <span class="mono-inline size-value">${formatBytes(r.pubKey)}</span>
      </div>`;
		})
		.join('');

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Compare</p>
        <h2>Public Key Sizes</h2>
        <p class="section-footnote">
          Bars use a <strong>log\u2082 scale</strong> \u2014 a linear axis would crush every scheme
          except Classic McEliece into a sliver. Even so, McEliece keys dwarf the rest, while
          hash-based and isogeny keys stay tiny. For reference, an RSA-3072 or ECC P-256 public
          key is only ~32\u2013384 bytes.
        </p>
      </div>
    </div>
    <div class="size-chart">${bars}</div>
  `;

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((e) => {
				if (e.isIntersecting) {
					section.querySelectorAll<HTMLElement>('.size-fill').forEach((f, i) => {
						setTimeout(() => {
							f.style.width = `${f.dataset.target}%`;
						}, i * 60);
					});
					observer.disconnect();
				}
			});
		},
		{ threshold: 0.25 },
	);
	observer.observe(section);

	return section;
}

// --- Section 3: head-to-head table ----------------------------------------
function renderTable(): HTMLElement {
	const section = el('section', 'lab-section');

	const body = FAMILIES.map(
		(f) => `
    <tr class="math-row">
      <td><strong>${f.name}</strong></td>
      <td>${f.hardProblem}</td>
      <td>${f.schemes.some((s) => s.kind === 'KEM') ? 'KEM' : ''}${
				f.schemes.some((s) => s.kind === 'KEM') && f.schemes.some((s) => s.kind === 'Signature')
					? ' + '
					: ''
			}${f.schemes.some((s) => s.kind === 'Signature') ? 'Signature' : ''}</td>
      <td class="mono-cell">${formatBytes(Math.min(...f.schemes.map((s) => s.pubKey)))}\u2013${formatBytes(
				Math.max(...f.schemes.map((s) => s.pubKey)),
			)}</td>
      <td>${maturityChip(f.maturity)}</td>
    </tr>`,
	).join('');

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">At a glance</p>
        <h2>Head to Head</h2>
        <p class="section-footnote">Every family on one row. Public-key range spans the schemes shown in the explorer above.</p>
      </div>
    </div>
    <div class="table-shell">
      <table class="math-table">
        <thead>
          <tr>
            <th>Family</th>
            <th>Hard problem</th>
            <th>Provides</th>
            <th>Public key range</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
	return section;
}

// --- Section 4: info tabs (educational deep-dive) -------------------------
function renderInfoTabs(): HTMLElement {
	const section = el('section', 'lab-section');
	const panels: Record<string, string> = {
		Shor: `<p>Peter Shor\u2019s 1994 quantum algorithm factors integers and computes discrete logarithms in polynomial time. That single result breaks RSA, Diffie\u2013Hellman, and elliptic-curve cryptography \u2014 the backbone of today\u2019s public-key security \u2014 once a sufficiently large, fault-tolerant quantum computer exists.</p><p>Post-quantum families are chosen precisely because no efficient quantum algorithm is known for their underlying problems. Grover\u2019s algorithm still gives a quadratic speedup against symmetric primitives, which is why AES-256 and SHA-384 remain recommended.</p>`,
		'Harvest now': `<p>\u201CHarvest now, decrypt later\u201D is the threat driving urgency today. An adversary can record encrypted traffic now and simply wait for a quantum computer to decrypt it years later. Any data that must stay secret beyond the arrival of quantum computing is already at risk.</p><p>This is why migration to ML-KEM and hybrid key exchange is happening before large quantum computers exist \u2014 the clock on long-lived secrets is already running.</p>`,
		'Why lattices won': `<p>Lattice schemes hit the sweet spot: kilobyte-scale keys, fast operations, strong security reductions, and the rare ability to support KEMs, signatures, and homomorphic encryption from one foundation. NIST made ML-KEM and ML-DSA its primary standards for exactly this balance.</p><p>Code-based and hash-based families serve as conservative, algorithmically diverse backups. Multivariate and isogeny finalists were broken outright in 2022, underscoring why diversity matters.</p>`,
		Hybrids: `<p>During migration, the safe move is to combine a classical algorithm with a post-quantum one so the result stays secure as long as either component holds. TLS deployments pairing X25519 with ML-KEM-768 are already widespread.</p><p>This hedges against two risks at once: an undiscovered flaw in a young PQC scheme, and the eventual arrival of quantum computers that break the classical half.</p>`,
	};

	const keys = Object.keys(panels);
	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Context</p>
        <h2>The Bigger Picture</h2>
      </div>
    </div>
    <div class="info-tabs" role="tablist" aria-label="Post-quantum context"></div>
    <div class="info-panels" id="info-panel" role="tabpanel" tabindex="0"></div>
  `;
	const tabRow = section.querySelector('.info-tabs') as HTMLElement;
	const panelHost = section.querySelector('.info-panels') as HTMLElement;

	const slug = (k: string) => `info-tab-${k.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

	const tabButtons = keys.map((k) => {
		const btn = el('button', 'tab-button', k);
		btn.type = 'button';
		btn.id = slug(k);
		btn.setAttribute('role', 'tab');
		btn.setAttribute('aria-controls', 'info-panel');
		btn.dataset.key = k;
		tabRow.appendChild(btn);
		return btn;
	});

	wireTablist(tabButtons, (btn) => {
		const key = btn.dataset.key!;
		panelHost.setAttribute('aria-labelledby', btn.id);
		panelHost.innerHTML = `<div class="info-panel">${panels[key]}</div>`;
	});

	return section;
}

function renderFooter(): HTMLElement {
	const footer = el('footer', 'lab-section');
	footer.innerHTML = `
    <p class="section-footnote">
      Sizes are representative parameter sets in bytes, drawn from NIST FIPS 203/204/205 and
      round-4 specifications. Educational use only \u2014 use a vetted library (liboqs, BouncyCastle,
      .NET) for production.
    </p>
    <p class="scripture">\u201CSo whether you eat or drink or whatever you do, do it all for the glory of God.\u201D \u2014 1 Corinthians 10:31</p>
  `;
	return footer;
}

export function mountApp(root: HTMLDivElement): void {
	const shell = el('div', 'page-shell');
	shell.append(
		renderHero(),
		renderExplorer(),
		renderSizeChart(),
		renderTable(),
		renderInfoTabs(),
		renderFooter(),
	);
	root.appendChild(shell);
}
