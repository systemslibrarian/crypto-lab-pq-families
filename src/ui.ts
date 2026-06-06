// ui.ts — builds and mounts the Post-Quantum Families interactive overview.
import {
	CLASSICAL_BASELINE,
	FAMILIES,
	GLOSSARY,
	HYBRID_OVERHEAD,
	MATURITY_LABEL,
	SECURITY_CATEGORIES,
	TIMELINE,
	TIMELINE_KIND_LABEL,
	formatBytes,
	type Family,
	type Scheme,
	type SecurityCategory,
	type TimelineKind,
} from './data.ts';

// URL hash routing — `#family=<id>&pins=<comma-list>` lets you deep-link
// to a specific family, persist pinned schemes, share the view, and survive
// a page refresh. We read/write the shared URLSearchParams so the two keys
// don't clobber each other.
function readHashParams(): URLSearchParams {
	return new URLSearchParams(window.location.hash.replace(/^#/, ''));
}

function writeHashParams(params: URLSearchParams): void {
	const str = params.toString();
	const next = str ? `#${str}` : window.location.pathname + window.location.search;
	if (window.location.hash !== '#' + str && window.location.hash !== next) {
		history.replaceState(null, '', next);
	}
}

function readHashFamily(): string | undefined {
	const id = readHashParams().get('family');
	if (!id) return undefined;
	return FAMILIES.some((f) => f.id === id) ? id : undefined;
}

function writeHashFamily(id: string): void {
	const p = readHashParams();
	p.set('family', id);
	writeHashParams(p);
}

// --- Shared pinned-schemes state ----------------------------------------
// Pinned scheme names are the cross-section "selection" state. Every widget
// that cares (scheme cards' pin button, the pinned drawer, the size chart,
// the head-to-head table) reads through getPins() and listens for the
// 'pq-pins-changed' custom event so they stay in sync without coupling
// directly to each other.
const PIN_EVENT = 'pq-pins-changed';

function getPins(): Set<string> {
	const raw = readHashParams().get('pins') ?? '';
	return new Set(raw.split(',').filter(Boolean));
}

function setPins(pins: Set<string>): void {
	const p = readHashParams();
	if (pins.size > 0) p.set('pins', Array.from(pins).join(','));
	else p.delete('pins');
	writeHashParams(p);
	window.dispatchEvent(new CustomEvent(PIN_EVENT, { detail: { pins } }));
}

function togglePin(name: string): void {
	const pins = getPins();
	if (pins.has(name)) pins.delete(name);
	else pins.add(name);
	setPins(pins);
}

function findSchemeByName(name: string): { family: Family; scheme: Scheme } | undefined {
	for (const f of FAMILIES) {
		const s = f.schemes.find((x) => x.name === name);
		if (s) return { family: f, scheme: s };
	}
	return undefined;
}

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
// Returns a `select(index)` callback so callers can drive the active tab
// from URL state, keyboard shortcuts, or programmatic navigation.
function wireTablist(
	tabs: HTMLButtonElement[],
	activate: (tab: HTMLButtonElement) => void,
	initialIndex = 0,
): (index: number) => void {
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

	const start = Math.max(0, Math.min(initialIndex, tabs.length - 1));
	if (tabs.length) select(tabs[start]);

	return (index: number) => {
		const clamped = Math.max(0, Math.min(index, tabs.length - 1));
		select(tabs[clamped]);
	};
}

function maturityChip(m: Family['maturity'], brokenYear?: number): string {
	const tone =
		m === 'broken'
			? 'scenario-status--invalid'
			: m === 'research'
				? 'scenario-status--pending'
				: 'scenario-status--valid';
	const label =
		m === 'broken' && brokenYear ? `${MATURITY_LABEL[m]} · ${brokenYear}` : MATURITY_LABEL[m];
	return `<span class="maturity-chip ${tone}">${label}</span>`;
}

function securityChip(cat?: SecurityCategory): string {
	if (!cat) return '';
	const equiv =
		cat === 1
			? 'AES-128'
			: cat === 2
				? 'SHA-256 collision'
				: cat === 3
					? 'AES-192'
					: 'AES-256';
	return `<span class="sec-chip" title="NIST Category ${cat} — effort floor pegged to ${equiv}">Cat ${cat} · ${equiv}</span>`;
}

function renderHero(): HTMLElement {
	const hero = el('header', 'hero-panel');
	hero.innerHTML = `
    <div class="hero-actions">
      <button id="copy-link" class="copy-link" type="button" aria-label="Copy link to this view"><span aria-hidden="true">\u{1F517}</span> Copy link</button>
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Switch theme">\u{1F319}</button>
    </div>
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
        <p class="section-footnote">Select a family to see its hard problem, tradeoffs, and representative schemes. <span class="kbd-tip">Tip: press <kbd>1</kbd>\u2013<kbd>5</kbd> to jump between families.</span></p>
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
		const pins = getPins();
		const schemeCards = family.schemes
			.map((s: Scheme) => {
				const isPinned = pins.has(s.name);
				return `
        <div class="panel-card panel-card--scheme ${isPinned ? 'panel-card--pinned' : ''}" data-scheme="${s.name}">
          <div class="panel-header">
            <h3>${s.name}</h3>
            <div class="chip-row">${maturityChip(s.maturity, s.brokenYear)}${securityChip(s.securityCategory)}</div>
          </div>
          <p class="panel-copy"><strong>${s.standard}</strong> \u00b7 ${s.kind}</p>
          <div class="math-summary-grid math-summary-grid--three">
            <div><p class="hero-metric-label">Public key</p><p class="mono-inline">${formatBytes(s.pubKey)}</p></div>
            <div><p class="hero-metric-label">Secret key</p><p class="mono-inline">${formatBytes(s.secretKey)}</p></div>
            <div><p class="hero-metric-label">${s.outputLabel}</p><p class="mono-inline">${formatBytes(s.output)}</p></div>
          </div>
          ${s.performance ? `<p class="panel-copy panel-perf"><strong>Performance:</strong> ${s.performance}</p>` : ''}
          ${s.cyclesNote ? `<p class="panel-bench"><span class="panel-bench-label">Cycles:</span> ${s.cyclesNote}</p>` : ''}
          <p class="panel-copy">${s.note}</p>
          <button type="button" class="pin-btn ${isPinned ? 'is-pinned' : ''}" data-pin="${s.name}" aria-pressed="${isPinned}">
            <span aria-hidden="true">${isPinned ? '\ud83d\udccd' : '\ud83d\udccc'}</span>
            <span>${isPinned ? 'Pinned' : 'Pin to compare'}</span>
          </button>
        </div>`;
			})
			.join('');

		const attacksHtml = family.attacks
			.map(
				(a) => `
        <li class="attack-item">
          <span class="attack-year mono-inline">${a.year}</span>
          <div class="attack-body">
            <p class="attack-name">${a.name}</p>
            <p class="panel-copy attack-summary">${a.summary}</p>
          </div>
        </li>`,
			)
			.join('');

		const refsHtml = family.references
			.map((r) => {
				const venue = r.venue ? `<span class="ref-venue">${r.venue}</span>` : '';
				const title = r.url
					? `<a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.title}</a>`
					: r.title;
				return `<li class="ref-item"><span class="ref-cite">${r.authors} \u00b7 ${r.year}</span><span class="ref-title">${title}</span>${venue}</li>`;
			})
			.join('');

		// Progressive disclosure: Overview is the default. Math / Attacks / Sources
		// each sit behind one sub-tab click, so first impression is summary +
		// schemes rather than a 1500-line wall.
		const overviewHtml = `
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
          <details class="confidence-note">
            <summary>What is this score?</summary>
            <p>Heuristic blend of NIST standardisation status, length of unbroken cryptanalysis history, and implementation maturity. Not a measured quantity \u2014 directional only.</p>
          </details>
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
      <p class="trust-badge">\u24d8 Sizes shown are representative parameter sets, not deployment values. Confirm against the relevant FIPS / specification before production use.</p>
      <div class="playground-grid">${schemeCards}</div>
    `;

		const mathHtml = `
      <div class="math-card">
        <p class="section-kicker">The hard problem, formally</p>
        <pre class="math-block">${family.mathProblem}</pre>
        ${family.reductionNote ? `<p class="panel-copy"><strong>Reduces from:</strong> ${family.reductionNote}</p>` : ''}
      </div>
    `;

		const attacksHtmlPanel = `
      <div class="panel-card">
        <h3>Notable cryptanalysis</h3>
        <ol class="attack-list">${attacksHtml}</ol>
      </div>
    `;

		const refsHtmlPanel = `
      <div class="panel-card">
        <h3>Further reading</h3>
        <ul class="ref-list">${refsHtml}</ul>
      </div>
    `;

		detail.innerHTML = `
      <div class="subview-tabs" role="tablist" aria-label="Family detail view">
        <button type="button" role="tab" class="subview-tab is-active" data-view="overview" aria-selected="true">Overview</button>
        <button type="button" role="tab" class="subview-tab" data-view="math" aria-selected="false">Math</button>
        <button type="button" role="tab" class="subview-tab" data-view="attacks" aria-selected="false">Attacks</button>
        <button type="button" role="tab" class="subview-tab" data-view="sources" aria-selected="false">Sources</button>
      </div>
      <div class="subview-panel" data-pane="overview">${overviewHtml}</div>
      <div class="subview-panel" data-pane="math" hidden>${mathHtml}</div>
      <div class="subview-panel" data-pane="attacks" hidden>${attacksHtmlPanel}</div>
      <div class="subview-panel" data-pane="sources" hidden>${refsHtmlPanel}</div>
    `;

		// Wire sub-tab switching (delegated since detail is rebuilt each family
		// switch, so adding once at outer scope wouldn't work).
		const subTabs = Array.from(detail.querySelectorAll<HTMLButtonElement>('.subview-tab'));
		const subPanels = Array.from(detail.querySelectorAll<HTMLElement>('.subview-panel'));
		subTabs.forEach((tab) => {
			tab.addEventListener('click', () => {
				const view = tab.dataset.view!;
				subTabs.forEach((t) => {
					const active = t === tab;
					t.classList.toggle('is-active', active);
					t.setAttribute('aria-selected', String(active));
				});
				subPanels.forEach((p) => {
					p.hidden = p.dataset.pane !== view;
				});
			});
		});

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

	const tabButtons = FAMILIES.map((family, i) => {
		const btn = el('button', 'tab-button', `<span class="tab-index">${i + 1}</span>${family.name}`);
		btn.type = 'button';
		btn.id = `family-tab-${family.id}`;
		btn.setAttribute('role', 'tab');
		btn.setAttribute('aria-controls', 'family-detail');
		btn.setAttribute('aria-keyshortcuts', String(i + 1));
		btn.dataset.id = family.id;
		tabs.appendChild(btn);
		return btn;
	});

	const initialId = readHashFamily();
	const initialIndex = initialId ? FAMILIES.findIndex((f) => f.id === initialId) : 0;

	const selectByIndex = wireTablist(
		tabButtons,
		(btn) => {
			const family = FAMILIES.find((f) => f.id === btn.dataset.id)!;
			detail.setAttribute('aria-labelledby', btn.id);
			paint(family);
			writeHashFamily(family.id);
		},
		Math.max(0, initialIndex),
	);

	// Number-key shortcuts (1–5) to jump between families — only when no
	// editable element is focused, so we don't fight inputs in other sections.
	document.addEventListener('keydown', (e) => {
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		const target = e.target as HTMLElement | null;
		if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable))
			return;
		const n = Number(e.key);
		if (!Number.isInteger(n) || n < 1 || n > FAMILIES.length) return;
		e.preventDefault();
		selectByIndex(n - 1);
		tabButtons[n - 1].focus();
	});

	// React to back/forward when the hash changes (e.g. via shared link).
	window.addEventListener('hashchange', () => {
		const id = readHashFamily();
		if (!id) return;
		const idx = FAMILIES.findIndex((f) => f.id === id);
		if (idx >= 0) selectByIndex(idx);
	});

	// Pin / unpin a scheme directly from its card.
	detail.addEventListener('click', (e) => {
		const btn = (e.target as HTMLElement).closest('[data-pin]') as HTMLButtonElement | null;
		if (!btn) return;
		togglePin(btn.dataset.pin!);
	});

	// Re-render the active family detail whenever pins change so the pin
	// button + pinned-card highlighting stay accurate.
	window.addEventListener(PIN_EVENT, () => {
		const activeBtn = tabButtons.find((b) => b.classList.contains('is-active'));
		if (!activeBtn) return;
		const family = FAMILIES.find((f) => f.id === activeBtn.dataset.id);
		if (family) paint(family);
	});

	return section;
}

// --- Section 2: size comparison with metric toggle ------------------------
type SizeMetric = 'pubKey' | 'secretKey' | 'output';

const METRIC_LABEL: Record<SizeMetric, string> = {
	pubKey: 'Public key',
	secretKey: 'Secret key',
	output: 'Ciphertext / Signature',
};

function renderSizeChart(): HTMLElement {
	const section = el('section', 'lab-section');

	const rows = FAMILIES.flatMap((f) =>
		f.schemes.map((s) => ({ family: f.name, fid: f.id, ...s })),
	);

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Compare</p>
        <h2>Sizes Across Families</h2>
        <p class="section-footnote">
          Bars use a <strong>log\u2082 scale</strong> \u2014 a linear axis would crush every scheme
          except Classic McEliece into a sliver. Switch the metric to see how each
          family stacks up on different axes. For reference, an RSA-3072 or ECC P-256
          public key is only ~32\u2013384 bytes.
        </p>
        <p class="trust-badge">\u24d8 Representative parameter sets \u2014 not deployment values. Confirm against the relevant FIPS / specification before production use.</p>
      </div>
      <div class="metric-toggle" role="tablist" aria-label="Size metric"></div>
    </div>
    <div class="size-chart"></div>
  `;

	const toggleHost = section.querySelector('.metric-toggle') as HTMLElement;
	const chartHost = section.querySelector('.size-chart') as HTMLElement;
	const metricKeys: SizeMetric[] = ['pubKey', 'secretKey', 'output'];

	function paint(metric: SizeMetric): void {
		const values = rows.map((r) => Math.max(1, r[metric]));
		const logs = values.map((v) => Math.log2(v));
		const minLog = Math.min(...logs);
		const maxLog = Math.max(...logs);
		const span = maxLog - minLog || 1;

		const pins = getPins();
		chartHost.innerHTML = rows
			.map((r, i) => {
				const norm = (logs[i] - minLog) / span;
				const pct = 4 + norm * 96;
				const sublabel =
					metric === 'output' ? `${r.family} \u00b7 ${r.outputLabel}` : `${r.family} \u00b7 ${r.kind}`;
				const isPinned = pins.has(r.name);
				return `
      <div class="size-row ${isPinned ? 'size-row--pinned' : ''}">
        <div class="size-label">
          <span class="size-name">${isPinned ? '<span aria-hidden="true" class="size-pin">\ud83d\udccd</span>' : ''}${r.name}</span>
          <span class="size-fam">${sublabel}</span>
        </div>
        <div class="size-track">
          <div class="size-fill size-fill--${r.fid}" style="width:0%" data-target="${pct.toFixed(2)}"></div>
        </div>
        <span class="mono-inline size-value">${formatBytes(values[i])}</span>
      </div>`;
			})
			.join('');

		requestAnimationFrame(() => {
			chartHost.querySelectorAll<HTMLElement>('.size-fill').forEach((f, i) => {
				setTimeout(() => {
					f.style.width = `${f.dataset.target}%`;
				}, i * 35);
			});
		});
	}

	// Re-paint when pins change so the pin glyphs and accent rows stay accurate.
	let currentMetric: SizeMetric = 'pubKey';
	window.addEventListener(PIN_EVENT, () => paint(currentMetric));

	const toggleButtons = metricKeys.map((m) => {
		const btn = el('button', 'tab-button tab-button--sm', METRIC_LABEL[m]);
		btn.type = 'button';
		btn.id = `metric-tab-${m}`;
		btn.setAttribute('role', 'tab');
		btn.dataset.metric = m;
		toggleHost.appendChild(btn);
		return btn;
	});

	wireTablist(toggleButtons, (btn) => {
		currentMetric = btn.dataset.metric as SizeMetric;
		paint(currentMetric);
	});

	return section;
}

// --- Section: handshake calculator ----------------------------------------
type HsState = { kemName: string; sigName: string; hybrid: boolean; chainDepth: 0 | 1 | 2 };

const KEM_SCHEMES = FAMILIES.flatMap((f) =>
	f.schemes.filter((s) => s.kind === 'KEM').map((s) => ({ family: f, scheme: s })),
);
const SIG_SCHEMES = FAMILIES.flatMap((f) =>
	f.schemes.filter((s) => s.kind === 'Signature').map((s) => ({ family: f, scheme: s })),
);

// Bytes-on-wire for the classical TLS 1.3 baseline:
//   client_key_share (kemPub) + server_key_share (kemOut)
// + server leaf cert pubkey + leaf cert signature
// + (chainDepth) × (intermediate cert pubkey + intermediate cert signature)
// + CertificateVerify (transcript signature)
//
// chainDepth must mirror what the PQC path accumulates, otherwise the
// classical-vs-PQC ratio gets distorted at depth > 0.
function classicalTotal(chainDepth = 0): number {
	const base =
		CLASSICAL_BASELINE.kemPub +
		CLASSICAL_BASELINE.kemOut +
		CLASSICAL_BASELINE.sigPub +
		2 * CLASSICAL_BASELINE.sigOut;
	const intermediates = chainDepth * (CLASSICAL_BASELINE.sigPub + CLASSICAL_BASELINE.sigOut);
	return base + intermediates;
}

function hybridTotal(chainDepth = 0): number {
	const base =
		HYBRID_OVERHEAD.kemPub +
		HYBRID_OVERHEAD.kemOut +
		HYBRID_OVERHEAD.sigPub +
		2 * HYBRID_OVERHEAD.sigOut;
	const intermediates = chainDepth * (HYBRID_OVERHEAD.sigPub + HYBRID_OVERHEAD.sigOut);
	return base + intermediates;
}

function renderHandshakeCalculator(): HTMLElement {
	const section = el('section', 'lab-section');

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Try it</p>
        <h2>Handshake Bytes</h2>
        <p class="section-footnote">
          Pick a KEM and a signature — the bar shows the bytes a TLS 1.3 handshake spends, compared with the X25519 + ECDSA P-256 baseline.
          <details class="inline-details"><summary>How the segments break down</summary>
            <p><em>Client key share</em> + <em>server key share</em> + <em>server cert public key</em> + <em>cert chain signature</em> + <em>transcript signature</em>. The chain-depth control adds intermediate certs (pk + sig each).</p>
          </details>
        </p>
      </div>
    </div>

    <div class="hs-presets" role="group" aria-label="Preset combinations"></div>

    <div class="hs-controls">
      <div class="control-group">
        <p class="hero-metric-label">KEM</p>
        <div class="hs-chips" role="radiogroup" aria-label="Choose a KEM" data-group="kem"></div>
      </div>
      <div class="control-group">
        <p class="hero-metric-label">Signature</p>
        <div class="hs-chips" role="radiogroup" aria-label="Choose a signature" data-group="sig"></div>
      </div>
      <div class="hs-chain control-group">
        <p class="hero-metric-label">Cert chain (intermediates)</p>
        <div class="hs-chain-buttons" role="radiogroup" aria-label="Cert chain depth"></div>
      </div>
      <label class="hybrid-toggle">
        <input type="checkbox" id="hs-hybrid" />
        <span><strong>Hybrid hedge</strong> \u2014 also send X25519 + ECDSA alongside the PQC scheme</span>
      </label>
    </div>

    <div class="hs-stack" id="hs-stack"></div>

    <div class="hs-legend" aria-hidden="true">
      <span class="legend-dot legend-dot--kempk"></span><span>KEM public key</span>
      <span class="legend-dot legend-dot--kemct"></span><span>KEM ciphertext</span>
      <span class="legend-dot legend-dot--sigpk"></span><span>Leaf cert pk</span>
      <span class="legend-dot legend-dot--certsig"></span><span>Leaf cert sig</span>
      <span class="legend-dot legend-dot--chain"></span><span>Intermediate cert (pk + sig)</span>
      <span class="legend-dot legend-dot--verifysig"></span><span>Transcript signature</span>
      <span class="legend-dot legend-dot--hybrid"></span><span>Classical hybrid</span>
    </div>

    <p class="hs-note" id="hs-note"></p>
  `;

	const state: HsState = {
		kemName: 'ML-KEM-768 (Kyber)',
		sigName: 'ML-DSA-65 (Dilithium)',
		hybrid: false,
		chainDepth: 0,
	};

	function renderChain(): void {
		const host = section.querySelector('.hs-chain-buttons') as HTMLElement;
		const opts: { d: 0 | 1 | 2; label: string }[] = [
			{ d: 0, label: '0' },
			{ d: 1, label: '1' },
			{ d: 2, label: '2' },
		];
		host.innerHTML = opts
			.map(
				(o) =>
					`<button type="button" role="radio" aria-checked="${state.chainDepth === o.d}" class="hs-chain-btn ${state.chainDepth === o.d ? 'is-active' : ''}" data-depth="${o.d}">${o.label}</button>`,
			)
			.join('');
	}

	const presets: { id: string; label: string; kem: string; sig: string; hybrid: boolean; tone?: 'warn' }[] = [
		{ id: 'nist', label: 'NIST primaries', kem: 'ML-KEM-768 (Kyber)', sig: 'ML-DSA-65 (Dilithium)', hybrid: false },
		{
			id: 'hybrid',
			label: 'Hybrid migration',
			kem: 'ML-KEM-768 (Kyber)',
			sig: 'ML-DSA-65 (Dilithium)',
			hybrid: true,
		},
		{
			id: 'conservative',
			label: 'Conservative',
			kem: 'Classic McEliece 348864',
			sig: 'SLH-DSA-128f (SPHINCS+)',
			hybrid: false,
		},
		{ id: 'compact', label: 'Compact sigs', kem: 'ML-KEM-768 (Kyber)', sig: 'Falcon-512', hybrid: false },
		{ id: 'broken', label: 'Broken combo', kem: 'SIKEp434', sig: 'Rainbow (Ia)', hybrid: false, tone: 'warn' },
	];

	function renderPresets(): void {
		const host = section.querySelector('.hs-presets') as HTMLElement;
		host.innerHTML =
			`<span class="hs-preset-label">Preset:</span>` +
			presets
				.map(
					(p) =>
						`<button type="button" class="hs-preset ${p.tone === 'warn' ? 'is-warn' : ''}" data-preset="${p.id}">${p.label}</button>`,
				)
				.join('');
	}

	function chipMarkup(group: 'kem' | 'sig', name: string, schemeName: string, family: string, broken: boolean): string {
		const isActive = name === schemeName;
		return `<button type="button" role="radio" class="hs-chip ${isActive ? 'is-active' : ''} ${broken ? 'is-broken' : ''}" aria-checked="${isActive}" data-group="${group}" data-name="${name}"><span class="hs-chip-name">${name}</span><span class="hs-chip-fam">${family}${broken ? ' \u00b7 broken' : ''}</span></button>`;
	}

	function renderChips(): void {
		const kemHost = section.querySelector('[data-group="kem"]') as HTMLElement;
		const sigHost = section.querySelector('[data-group="sig"]') as HTMLElement;
		kemHost.innerHTML = KEM_SCHEMES.map(({ family, scheme }) =>
			chipMarkup('kem', scheme.name, state.kemName, family.name, scheme.maturity === 'broken'),
		).join('');
		sigHost.innerHTML = SIG_SCHEMES.map(({ family, scheme }) =>
			chipMarkup('sig', scheme.name, state.sigName, family.name, scheme.maturity === 'broken'),
		).join('');
	}

	function findKem(name: string): Scheme {
		return KEM_SCHEMES.find((s) => s.scheme.name === name)!.scheme;
	}
	function findSig(name: string): Scheme {
		return SIG_SCHEMES.find((s) => s.scheme.name === name)!.scheme;
	}

	function paint(): void {
		const kem = findKem(state.kemName);
		const sig = findSig(state.sigName);

		const segments = [
			{ cls: 'kempk', label: 'KEM pk', bytes: kem.pubKey },
			{ cls: 'kemct', label: 'KEM ct', bytes: kem.output },
			{ cls: 'sigpk', label: 'Sig pk', bytes: sig.pubKey },
			{ cls: 'certsig', label: 'Cert sig', bytes: sig.output },
		];
		// Each intermediate CA contributes its own pk + chain signature.
		for (let i = 0; i < state.chainDepth; i++) {
			segments.push({ cls: 'chain', label: `Int ${i + 1}`, bytes: sig.pubKey + sig.output });
		}
		segments.push({ cls: 'verifysig', label: 'Verify sig', bytes: sig.output });
		if (state.hybrid) {
			segments.push({ cls: 'hybrid', label: 'Hybrid', bytes: hybridTotal(state.chainDepth) });
		}

		const pqcTotal = segments.reduce((sum, s) => sum + s.bytes, 0);
		const classical = classicalTotal(state.chainDepth);
		const scaleMax = Math.max(pqcTotal, classical);

		const pqcSegMarkup = segments
			.map((s) => {
				const pct = (s.bytes / scaleMax) * 100;
				const wideEnough = pct > 6;
				return `<div class="hs-seg hs-seg--${s.cls}" style="width:0%" data-target="${pct.toFixed(3)}" title="${s.label}: ${formatBytes(s.bytes)}">${wideEnough ? `<span class="hs-seg-label">${s.label}</span>` : ''}</div>`;
			})
			.join('');

		const classicalSegBytes = [
			{ cls: 'kempk', bytes: CLASSICAL_BASELINE.kemPub },
			{ cls: 'kemct', bytes: CLASSICAL_BASELINE.kemOut },
			{ cls: 'sigpk', bytes: CLASSICAL_BASELINE.sigPub },
			{ cls: 'certsig', bytes: CLASSICAL_BASELINE.sigOut },
		];
		// Same chain-depth model on the classical baseline so the ratio is honest.
		for (let i = 0; i < state.chainDepth; i++) {
			classicalSegBytes.push({
				cls: 'chain',
				bytes: CLASSICAL_BASELINE.sigPub + CLASSICAL_BASELINE.sigOut,
			});
		}
		classicalSegBytes.push({ cls: 'verifysig', bytes: CLASSICAL_BASELINE.sigOut });
		const classicalSegMarkup = classicalSegBytes
			.map((s) => {
				const pct = (s.bytes / scaleMax) * 100;
				return `<div class="hs-seg hs-seg--${s.cls}" style="width:0%" data-target="${pct.toFixed(3)}"></div>`;
			})
			.join('');

		const stackHost = section.querySelector('#hs-stack') as HTMLElement;
		stackHost.innerHTML = `
      <div class="hs-row hs-row--pqc">
        <div class="hs-label">
          <span class="hs-label-name">PQC handshake</span>
          <span class="hs-label-detail">${kem.name} + ${sig.name}${state.hybrid ? ' + X25519/ECDSA' : ''}</span>
        </div>
        <div class="hs-track">${pqcSegMarkup}</div>
        <span class="mono-inline hs-total">${formatBytes(pqcTotal)}</span>
      </div>
      <div class="hs-row hs-row--classical">
        <div class="hs-label">
          <span class="hs-label-name">Classical baseline</span>
          <span class="hs-label-detail">${CLASSICAL_BASELINE.name}</span>
        </div>
        <div class="hs-track">${classicalSegMarkup}</div>
        <span class="mono-inline hs-total">${formatBytes(classical)}</span>
      </div>
    `;

		requestAnimationFrame(() => {
			stackHost.querySelectorAll<HTMLElement>('.hs-seg').forEach((seg, i) => {
				setTimeout(() => {
					seg.style.width = `${seg.dataset.target}%`;
				}, i * 30);
			});
		});

		const ratio = pqcTotal / classical;
		const ratioText = ratio >= 100 ? ratio.toFixed(0) : ratio.toFixed(1);
		const noteHost = section.querySelector('#hs-note') as HTMLElement;
		const brokenWarn =
			kem.maturity === 'broken' || sig.maturity === 'broken'
				? `<strong class="hs-note-warn">\u26a0 One of these schemes is broken \u2014 shown for comparison only.</strong> `
				: '';
		noteHost.innerHTML = `${brokenWarn}This handshake spends <strong>${formatBytes(pqcTotal)}</strong> on key exchange and authentication \u2014 about <strong>${ratioText}\u00d7</strong> the classical baseline (<strong>${formatBytes(classical)}</strong>).${state.hybrid ? ' Hybrid adds the classical hedge so the connection stays secure as long as either component holds.' : ''}`;
	}

	renderPresets();
	renderChips();
	renderChain();
	paint();

	function applyConfig(kem: string, sig: string, hybrid: boolean): void {
		state.kemName = kem;
		state.sigName = sig;
		state.hybrid = hybrid;
		const hybridToggle = section.querySelector('#hs-hybrid') as HTMLInputElement | null;
		if (hybridToggle) hybridToggle.checked = hybrid;
		renderChips();
		paint();
	}

	section.addEventListener('click', (e) => {
		const target = e.target as HTMLElement;
		const preset = target.closest('.hs-preset') as HTMLButtonElement | null;
		if (preset) {
			const p = presets.find((x) => x.id === preset.dataset.preset);
			if (p) applyConfig(p.kem, p.sig, p.hybrid);
			return;
		}
		const chainBtn = target.closest('.hs-chain-btn') as HTMLButtonElement | null;
		if (chainBtn) {
			state.chainDepth = Number(chainBtn.dataset.depth) as 0 | 1 | 2;
			renderChain();
			paint();
			return;
		}
		const chip = target.closest('.hs-chip') as HTMLButtonElement | null;
		if (!chip) return;
		const group = chip.dataset.group as 'kem' | 'sig';
		const name = chip.dataset.name!;
		if (group === 'kem') state.kemName = name;
		else state.sigName = name;
		renderChips();
		paint();
	});

	const hybridToggle = section.querySelector('#hs-hybrid') as HTMLInputElement;
	hybridToggle.addEventListener('change', () => {
		state.hybrid = hybridToggle.checked;
		paint();
	});

	// Cross-section drive: the recommender wizard dispatches this custom event
	// when the user clicks "Try this combo", so the calculator updates and
	// scrolls into view in a single gesture.
	window.addEventListener('pq-handshake-set', (e) => {
		const detail = (e as CustomEvent<{ kem: string; sig: string; hybrid: boolean }>).detail;
		applyConfig(detail.kem, detail.sig, detail.hybrid);
		section.scrollIntoView({ behavior: 'smooth', block: 'start' });
	});

	return section;
}

// --- Section: PQC timeline ------------------------------------------------
const TIMELINE_TONE: Record<TimelineKind, string> = {
	theory: 'tl-tone--theory',
	broken: 'tl-tone--broken',
	standard: 'tl-tone--standard',
	milestone: 'tl-tone--milestone',
};

function renderTimeline(): HTMLElement {
	const section = el('section', 'lab-section');

	const events = TIMELINE.map(
		(ev) => `
    <li class="tl-event ${TIMELINE_TONE[ev.kind]}">
      <span class="tl-year mono-inline">${ev.year}</span>
      <div class="tl-marker" aria-hidden="true"></div>
      <div class="tl-body">
        <p class="tl-title">${ev.title} <span class="tl-kind">${TIMELINE_KIND_LABEL[ev.kind]}</span></p>
        <p class="panel-copy tl-text">${ev.body}</p>
      </div>
    </li>`,
	).join('');

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">History</p>
        <h2>How We Got Here</h2>
        <p class="section-footnote">From McEliece in 1978 to the FIPS standards of 2024. Two of the five families had their flagship scheme broken in a single year (2022) \u2014 a reminder that "post-quantum" is a moving target, not a finish line.</p>
      </div>
    </div>
    <ol class="timeline-rail">${events}</ol>
  `;

	return section;
}

// --- Section 3: head-to-head table ----------------------------------------
function renderTable(): HTMLElement {
	const section = el('section', 'lab-section');

	function paint(): void {
		const pins = getPins();
		const body = FAMILIES.map((f) => {
			const familyPinned = f.schemes.some((s) => pins.has(s.name));
			return `
    <tr class="math-row ${familyPinned ? 'math-row--pinned' : ''}">
      <td><strong>${familyPinned ? '<span aria-hidden="true" class="size-pin">\ud83d\udccd</span>' : ''}${f.name}</strong></td>
      <td>${f.hardProblem}</td>
      <td>${f.schemes.some((s) => s.kind === 'KEM') ? 'KEM' : ''}${
				f.schemes.some((s) => s.kind === 'KEM') && f.schemes.some((s) => s.kind === 'Signature')
					? ' + '
					: ''
			}${f.schemes.some((s) => s.kind === 'Signature') ? 'Signature' : ''}</td>
      <td class="mono-cell">${formatBytes(Math.min(...f.schemes.map((s) => s.pubKey)))}\u2013${formatBytes(
				Math.max(...f.schemes.map((s) => s.pubKey)),
			)}</td>
      <td>${maturityChip(f.maturity, f.schemes.find((s) => s.brokenYear)?.brokenYear)}</td>
    </tr>`;
		}).join('');

		const tbody = section.querySelector('tbody');
		if (tbody) tbody.innerHTML = body;
	}

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">At a glance</p>
        <h2>Head to Head</h2>
        <p class="section-footnote">Every family on one row. Public-key range spans the schemes shown in the explorer above. Rows with a pin glyph contain a pinned scheme.</p>
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
        <tbody></tbody>
      </table>
    </div>
  `;
	paint();
	window.addEventListener(PIN_EVENT, paint);
	return section;
}

// --- Section: 2D lattice visualisation ------------------------------------
// SVG canvas with two draggable basis vectors. We render every integer
// combination a·b1 + b·b2 within a small box, then highlight the shortest
// non-zero vector. The point isn't to compute SVP in 2D (trivial) but to
// build the right *intuition* before the page asks the reader to take
// 256-dimensional Module-LWE seriously.
function renderLatticeViz(): HTMLElement {
	const section = el('section', 'lab-section');
	const W = 540;
	const H = 360;
	const cx = W / 2;
	const cy = H / 2;
	const RANGE = 10; // |a|, |b| ≤ RANGE for lattice points

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">See it</p>
        <h2>What "Short Vector" Means</h2>
        <p class="section-footnote">
          Drag <span class="lat-b1-name">b₁</span> and <span class="lat-b2-name">b₂</span> to reshape the lattice — the highlighted vector is always the shortest non-zero lattice point. SVP in 2D is trivial; ML-KEM hides a secret in a noisy version of this picture in <strong>256 dimensions</strong>, where finding short vectors is conjectured hard for both classical and quantum computers.
        </p>
      </div>
    </div>

    <div class="lat-wrap">
      <svg class="lat-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Interactive 2D lattice visualisation">
        <defs>
          <marker id="lat-arrow-1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
          </marker>
          <marker id="lat-arrow-2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent-2)" />
          </marker>
          <marker id="lat-arrow-s" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent-3)" />
          </marker>
        </defs>
        <g class="lat-axes" stroke="var(--line)" stroke-width="1">
          <line x1="0" y1="${cy}" x2="${W}" y2="${cy}" />
          <line x1="${cx}" y1="0" x2="${cx}" y2="${H}" />
        </g>
        <g class="lat-points"></g>
        <polygon class="lat-fund" fill="rgba(11,127,171,0.10)" stroke="rgba(11,127,171,0.40)" stroke-dasharray="4 4" />
        <line class="lat-short" stroke="var(--accent-3)" stroke-width="3" marker-end="url(#lat-arrow-s)" />
        <line class="lat-b1" stroke="var(--accent)" stroke-width="3" marker-end="url(#lat-arrow-1)" />
        <line class="lat-b2" stroke="var(--accent-2)" stroke-width="3" marker-end="url(#lat-arrow-2)" />
        <circle class="lat-handle lat-handle--b1" r="9" fill="var(--accent)" tabindex="0" aria-label="Basis vector b1 endpoint" />
        <circle class="lat-handle lat-handle--b2" r="9" fill="var(--accent-2)" tabindex="0" aria-label="Basis vector b2 endpoint" />
      </svg>

      <div class="lat-readout">
        <div class="lat-line"><span class="legend-dot" style="background:var(--accent)"></span><span><strong>b₁</strong> = <span class="mono-inline lat-b1-text"></span></span></div>
        <div class="lat-line"><span class="legend-dot" style="background:var(--accent-2)"></span><span><strong>b₂</strong> = <span class="mono-inline lat-b2-text"></span></span></div>
        <div class="lat-line"><span class="legend-dot" style="background:var(--accent-3)"></span><span><strong>shortest</strong> = <span class="mono-inline lat-short-text"></span></span></div>
        <div class="lat-line lat-line--meta">
          <span>‖b₁‖ · ‖b₂‖ = <span class="mono-inline lat-prod"></span></span>
          <span>det = <span class="mono-inline lat-det"></span></span>
          <span>orthogonality defect = <span class="mono-inline lat-defect"></span></span>
        </div>
        <div class="lat-verdict" id="lat-verdict"></div>
        <div class="lat-actions">
          <button type="button" class="hs-preset" data-lat-preset="orthogonal">Orthogonal basis</button>
          <button type="button" class="hs-preset" data-lat-preset="bad">Bad (long, near-parallel) basis</button>
          <button type="button" class="hs-preset" data-lat-preset="hex">Hexagonal lattice</button>
          <button type="button" class="hs-preset" data-lat-preset="reduce">Reduce (Lagrange–Gauss)</button>
        </div>
        <p class="lat-note">A <em>good</em> basis is short and nearly orthogonal — defect close to 1. Lattice-based cryptography hides the good basis (secret key) behind a bad one (public key). Recovering the good basis from the bad one is the lattice problem.</p>
      </div>
    </div>
  `;

	// Pixel-space state for the two basis vectors. Y in SVG grows downward, so
	// a "math y" of +1 corresponds to pixel offset of -SCALE.
	const SCALE = 30; // pixels per unit
	let b1 = { x: 3, y: 1 };
	let b2 = { x: 1, y: 2 };
	const svg = section.querySelector('.lat-svg') as SVGSVGElement;

	function toScreen(v: { x: number; y: number }): { x: number; y: number } {
		return { x: cx + v.x * SCALE, y: cy - v.y * SCALE };
	}

	function norm(v: { x: number; y: number }): number {
		return Math.sqrt(v.x * v.x + v.y * v.y);
	}

	// Brute-force shortest non-zero lattice vector for small RANGE — trivially
	// correct in 2D; the visual point is the geometry, not the algorithm.
	function shortestVec(): { x: number; y: number; a: number; b: number } {
		let best: { x: number; y: number; a: number; b: number; len: number } = {
			x: b1.x,
			y: b1.y,
			a: 1,
			b: 0,
			len: norm(b1),
		};
		for (let a = -RANGE; a <= RANGE; a++) {
			for (let b = -RANGE; b <= RANGE; b++) {
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

	function determinant(): number {
		return Math.abs(b1.x * b2.y - b1.y * b2.x);
	}

	// One step of Lagrange–Gauss reduction in 2D.
	function lagrangeGaussStep(): void {
		// Always have ‖b1‖ ≤ ‖b2‖
		if (norm(b2) < norm(b1)) {
			const tmp = b1;
			b1 = b2;
			b2 = tmp;
		}
		const mu = Math.round((b1.x * b2.x + b1.y * b2.y) / (b1.x * b1.x + b1.y * b1.y));
		b2 = { x: b2.x - mu * b1.x, y: b2.y - mu * b1.y };
	}

	function format(v: { x: number; y: number }): string {
		return `(${v.x.toFixed(2)}, ${v.y.toFixed(2)})`;
	}

	function repaint(): void {
		const o = toScreen({ x: 0, y: 0 });
		const p1 = toScreen(b1);
		const p2 = toScreen(b2);
		const p12 = toScreen({ x: b1.x + b2.x, y: b1.y + b2.y });

		const setLine = (sel: string, end: { x: number; y: number }) => {
			const ln = svg.querySelector(sel) as SVGLineElement;
			ln.setAttribute('x1', String(o.x));
			ln.setAttribute('y1', String(o.y));
			ln.setAttribute('x2', String(end.x));
			ln.setAttribute('y2', String(end.y));
		};
		setLine('.lat-b1', p1);
		setLine('.lat-b2', p2);

		(svg.querySelector('.lat-handle--b1') as SVGCircleElement).setAttribute('cx', String(p1.x));
		(svg.querySelector('.lat-handle--b1') as SVGCircleElement).setAttribute('cy', String(p1.y));
		(svg.querySelector('.lat-handle--b2') as SVGCircleElement).setAttribute('cx', String(p2.x));
		(svg.querySelector('.lat-handle--b2') as SVGCircleElement).setAttribute('cy', String(p2.y));

		// fundamental parallelogram
		const fund = svg.querySelector('.lat-fund') as SVGPolygonElement;
		fund.setAttribute(
			'points',
			`${o.x},${o.y} ${p1.x},${p1.y} ${p12.x},${p12.y} ${p2.x},${p2.y}`,
		);

		// lattice points (excluding origin)
		const pointsHost = svg.querySelector('.lat-points') as SVGGElement;
		const dots: string[] = [];
		for (let a = -RANGE; a <= RANGE; a++) {
			for (let b = -RANGE; b <= RANGE; b++) {
				const vx = a * b1.x + b * b2.x;
				const vy = a * b1.y + b * b2.y;
				const px = cx + vx * SCALE;
				const py = cy - vy * SCALE;
				if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
				const isOrigin = a === 0 && b === 0;
				dots.push(
					`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${isOrigin ? 4 : 2.4}" fill="${isOrigin ? 'var(--ink-strong)' : 'var(--ink-soft)'}" opacity="${isOrigin ? '1' : '0.55'}" />`,
				);
			}
		}
		pointsHost.innerHTML = dots.join('');

		// shortest vector
		const s = shortestVec();
		const ps = toScreen(s);
		setLine('.lat-short', ps);

		// readouts
		(section.querySelector('.lat-b1-text') as HTMLElement).textContent = format(b1);
		(section.querySelector('.lat-b2-text') as HTMLElement).textContent = format(b2);
		(section.querySelector('.lat-short-text') as HTMLElement).textContent =
			`${s.a}·b₁ + ${s.b}·b₂ = (${s.x.toFixed(2)}, ${s.y.toFixed(2)}) · ‖·‖ = ${norm(s).toFixed(3)}`;
		(section.querySelector('.lat-prod') as HTMLElement).textContent = (norm(b1) * norm(b2)).toFixed(3);
		const det = determinant();
		(section.querySelector('.lat-det') as HTMLElement).textContent = det.toFixed(3);
		const defect = det > 0 ? (norm(b1) * norm(b2)) / det : Infinity;
		(section.querySelector('.lat-defect') as HTMLElement).textContent = Number.isFinite(defect)
			? defect.toFixed(3)
			: '∞';

		const verdict = section.querySelector('#lat-verdict') as HTMLElement;
		let label: string;
		let tone: string;
		if (!Number.isFinite(defect) || defect > 50) {
			label = 'Near-singular — basis vectors are almost parallel';
			tone = 'lat-verdict--bad';
		} else if (defect > 4) {
			label = 'Bad basis — long, near-parallel; hides short vectors well';
			tone = 'lat-verdict--bad';
		} else if (defect > 1.5) {
			label = 'Decent basis — partially reduced';
			tone = 'lat-verdict--mid';
		} else if (defect > 1.05) {
			label = 'Good basis — short and nearly orthogonal';
			tone = 'lat-verdict--good';
		} else {
			label = 'Optimal — basis vectors are orthogonal';
			tone = 'lat-verdict--good';
		}
		verdict.className = `lat-verdict ${tone}`;
		verdict.textContent = label;
	}

	function pointerToBasis(
		clientX: number,
		clientY: number,
	): { x: number; y: number } {
		const rect = svg.getBoundingClientRect();
		const sx = (W / rect.width) * (clientX - rect.left);
		const sy = (H / rect.height) * (clientY - rect.top);
		return { x: (sx - cx) / SCALE, y: -(sy - cy) / SCALE };
	}

	function startDrag(which: 'b1' | 'b2', e: PointerEvent): void {
		e.preventDefault();
		const handle = e.currentTarget as Element;
		handle.setPointerCapture(e.pointerId);
		const move = (ev: PointerEvent) => {
			const next = pointerToBasis(ev.clientX, ev.clientY);
			// Clamp to a tasteful range
			next.x = Math.max(-RANGE, Math.min(RANGE, next.x));
			next.y = Math.max(-RANGE, Math.min(RANGE, next.y));
			if (which === 'b1') b1 = next;
			else b2 = next;
			repaint();
		};
		const up = (ev: PointerEvent) => {
			handle.releasePointerCapture(ev.pointerId);
			handle.removeEventListener('pointermove', move as EventListener);
			handle.removeEventListener('pointerup', up as EventListener);
		};
		handle.addEventListener('pointermove', move as EventListener);
		handle.addEventListener('pointerup', up as EventListener);
	}

	(svg.querySelector('.lat-handle--b1') as SVGCircleElement).addEventListener('pointerdown', (e) =>
		startDrag('b1', e as PointerEvent),
	);
	(svg.querySelector('.lat-handle--b2') as SVGCircleElement).addEventListener('pointerdown', (e) =>
		startDrag('b2', e as PointerEvent),
	);

	// Keyboard nudges for accessibility — focus a handle and use arrow keys.
	function keyboardNudge(which: 'b1' | 'b2', e: KeyboardEvent): void {
		const step = e.shiftKey ? 1 : 0.25;
		let dx = 0;
		let dy = 0;
		if (e.key === 'ArrowRight') dx = step;
		else if (e.key === 'ArrowLeft') dx = -step;
		else if (e.key === 'ArrowUp') dy = step;
		else if (e.key === 'ArrowDown') dy = -step;
		else return;
		e.preventDefault();
		const v = which === 'b1' ? b1 : b2;
		const next = {
			x: Math.max(-RANGE, Math.min(RANGE, v.x + dx)),
			y: Math.max(-RANGE, Math.min(RANGE, v.y + dy)),
		};
		if (which === 'b1') b1 = next;
		else b2 = next;
		repaint();
	}
	(svg.querySelector('.lat-handle--b1') as SVGCircleElement).addEventListener('keydown', (e) =>
		keyboardNudge('b1', e as KeyboardEvent),
	);
	(svg.querySelector('.lat-handle--b2') as SVGCircleElement).addEventListener('keydown', (e) =>
		keyboardNudge('b2', e as KeyboardEvent),
	);

	section.addEventListener('click', (e) => {
		const btn = (e.target as HTMLElement).closest('[data-lat-preset]') as HTMLButtonElement | null;
		if (!btn) return;
		switch (btn.dataset.latPreset) {
			case 'orthogonal':
				b1 = { x: 3, y: 0 };
				b2 = { x: 0, y: 2 };
				break;
			case 'bad':
				b1 = { x: 5, y: 2 };
				b2 = { x: 6, y: 2.4 };
				break;
			case 'hex':
				b1 = { x: 2, y: 0 };
				b2 = { x: 1, y: Math.sqrt(3) };
				break;
			case 'reduce':
				lagrangeGaussStep();
				break;
		}
		repaint();
	});

	repaint();
	return section;
}

// --- Section: information-set-decoding (ISD) work calculator -------------
// Prange (1962) iterates a random information-set selection; each iteration
// succeeds with probability C(n-k, t) / C(n, t). Expected work is therefore
// C(n, t) / C(n-k, t) operations, ignoring polynomial factors.
//
// log₂ C(n, k) is computed directly so n in the thousands stays numerically
// stable (no huge intermediate factorials).
function log2Binom(n: number, k: number): number {
	if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
	if (k === 0 || k === n) return 0;
	const kk = Math.min(k, n - k);
	let r = 0;
	for (let i = 1; i <= kk; i++) {
		r += Math.log2((n - i + 1) / i);
	}
	return r;
}

function renderISDCalc(): HTMLElement {
	const section = el('section', 'lab-section');

	const presets = [
		{ id: 'mc-348864', label: 'McEliece 348864 (Cat 1)', n: 3488, k: 2720, t: 64 },
		{ id: 'mc-460896', label: 'McEliece 460896 (Cat 3)', n: 4608, k: 3360, t: 96 },
		{ id: 'mc-6688128', label: 'McEliece 6688128 (Cat 5)', n: 6688, k: 5024, t: 128 },
	];

	const state = { n: 3488, k: 2720, t: 64 };

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Calculate</p>
        <h2>ISD Work: Why McEliece Hits Cat 1</h2>
        <p class="section-footnote">
          Each Prange ISD trial succeeds with probability C(n−k, t) / C(n, t), so expected work is <span class="mono-inline">C(n, t) / C(n−k, t)</span>. Slide n, k, t and watch bits move into NIST's category floors.
        </p>
      </div>
    </div>

    <div class="isd-presets">
      <span class="hs-preset-label">Preset:</span>
      ${presets.map((p) => `<button type="button" class="hs-preset" data-isd-preset="${p.id}">${p.label}</button>`).join('')}
    </div>

    <div class="isd-controls">
      <label class="isd-slider">
        <span class="hero-metric-label">Code length n</span>
        <input type="range" id="isd-n" min="500" max="8192" step="32" />
        <span class="mono-inline isd-n-val"></span>
      </label>
      <label class="isd-slider">
        <span class="hero-metric-label">Dimension k</span>
        <input type="range" id="isd-k" min="200" max="8000" step="32" />
        <span class="mono-inline isd-k-val"></span>
      </label>
      <label class="isd-slider">
        <span class="hero-metric-label">Errors t</span>
        <input type="range" id="isd-t" min="10" max="200" step="1" />
        <span class="mono-inline isd-t-val"></span>
      </label>
    </div>

    <div class="isd-result">
      <div class="rec-line">
        <span class="rec-line-label">Prange bits (classical)</span>
        <span class="rec-line-value mono-inline isd-bits"></span>
      </div>
      <div class="rec-line">
        <span class="rec-line-label">Approx. with Grover (quantum)</span>
        <span class="rec-line-value mono-inline isd-qbits"></span>
      </div>
      <div class="rec-line">
        <span class="rec-line-label">Per-trial success probability</span>
        <span class="rec-line-value mono-inline isd-prob"></span>
      </div>
      <div class="rec-line">
        <span class="rec-line-label">Expected trials</span>
        <span class="rec-line-value mono-inline isd-trials"></span>
      </div>
      <div class="rec-line">
        <span class="rec-line-label">NIST category fit</span>
        <span class="rec-line-value isd-cat"></span>
      </div>
    </div>

    <p class="isd-note">
      Prange (1962) is the textbook ISD — transparent, easy to verify against the binomial ratio,
      and a useful first estimate. Modern variants (May–Meurer–Thomae 2011, Becker–Joux–May–Meurer 2012,
      Both–May 2018) tighten the asymptotic exponent and shave bits at typical PQC parameters; NIST's
      category floors of 143 / 207 / 272 classical bits at Cat 1 / 3 / 5 are pegged to those best-known
      attacks with memory constraints. The point of the slider is to feel how n, k, t trade off — not to
      reproduce the standardisation analyses bit-for-bit.
    </p>
  `;

	const nIn = section.querySelector('#isd-n') as HTMLInputElement;
	const kIn = section.querySelector('#isd-k') as HTMLInputElement;
	const tIn = section.querySelector('#isd-t') as HTMLInputElement;

	function paint(): void {
		nIn.value = String(state.n);
		kIn.value = String(state.k);
		tIn.value = String(state.t);
		(section.querySelector('.isd-n-val') as HTMLElement).textContent = String(state.n);
		(section.querySelector('.isd-k-val') as HTMLElement).textContent = String(state.k);
		(section.querySelector('.isd-t-val') as HTMLElement).textContent = String(state.t);
		const nk = state.n - state.k;
		const bits = log2Binom(state.n, state.t) - log2Binom(nk, state.t);
		const valid = state.k < state.n && state.t <= nk && Number.isFinite(bits);
		const bitsText = valid ? `${bits.toFixed(1)} bits` : '— (invalid)';
		(section.querySelector('.isd-bits') as HTMLElement).textContent = bitsText;
		(section.querySelector('.isd-qbits') as HTMLElement).textContent = valid
			? `≈ ${(bits / 2).toFixed(1)} bits`
			: '—';

		// Per-trial probability of randomly hitting a valid info set is 2^-bits;
		// expected trials is 2^bits. Render in human-friendly base-10 order of mag.
		const log10 = bits * Math.log10(2);
		const probText = valid ? `1 in 10^${log10.toFixed(1)}` : '—';
		const trialsText = valid ? `≈ 10^${log10.toFixed(1)}` : '—';
		(section.querySelector('.isd-prob') as HTMLElement).textContent = probText;
		(section.querySelector('.isd-trials') as HTMLElement).textContent = trialsText;

		const cat = !valid
			? '—'
			: bits >= 272
				? '✓ above Cat 5 floor (2^272 classical)'
				: bits >= 207
					? '✓ above Cat 3 floor (2^207 classical)'
					: bits >= 143
						? '✓ above Cat 1 floor (2^143 classical)'
						: bits >= 100
							? '◔ approaching Cat 1 floor'
							: '✗ below Cat 1 floor — not PQC-grade';
		const catEl = section.querySelector('.isd-cat') as HTMLElement;
		catEl.textContent = cat;
		catEl.className = !valid
			? 'rec-line-value isd-cat'
			: bits >= 143
				? 'rec-line-value isd-cat isd-cat--ok'
				: bits >= 100
					? 'rec-line-value isd-cat isd-cat--mid'
					: 'rec-line-value isd-cat isd-cat--bad';
	}

	function attach(input: HTMLInputElement, key: 'n' | 'k' | 't'): void {
		input.addEventListener('input', () => {
			state[key] = Math.max(1, Number(input.value));
			// Enforce k < n and t ≤ n - k
			if (state.k >= state.n) state.k = state.n - 1;
			if (state.t > state.n - state.k) state.t = state.n - state.k;
			paint();
		});
	}
	attach(nIn, 'n');
	attach(kIn, 'k');
	attach(tIn, 't');

	section.addEventListener('click', (e) => {
		const btn = (e.target as HTMLElement).closest('[data-isd-preset]') as HTMLButtonElement | null;
		if (!btn) return;
		const p = presets.find((x) => x.id === btn.dataset.isdPreset);
		if (!p) return;
		state.n = p.n;
		state.k = p.k;
		state.t = p.t;
		paint();
	});

	paint();
	return section;
}

// --- Section: implementation status table ---------------------------------
function renderImplStatus(): HTMLElement {
	const section = el('section', 'lab-section');

	type CellState = 'ship' | 'exp' | 'planned' | 'none';
	const LIBS = ['liboqs', 'OpenSSL 3.x', 'BoringSSL', 'BouncyCastle', 'CIRCL', 'RustCrypto'];

	// Status approximate as of mid-2026; based on each project's published changelogs
	// and PQC-related releases. Footnote is explicit about this snapshot semantics.
	const rows: { scheme: string; cells: CellState[] }[] = [
		{ scheme: 'ML-KEM-768', cells: ['ship', 'exp', 'ship', 'ship', 'ship', 'ship'] },
		{ scheme: 'ML-DSA-65', cells: ['ship', 'exp', 'exp', 'ship', 'ship', 'exp'] },
		{ scheme: 'Falcon-512 (FN-DSA)', cells: ['ship', 'exp', 'none', 'ship', 'none', 'planned'] },
		{ scheme: 'SLH-DSA-128f (SPHINCS+)', cells: ['ship', 'exp', 'none', 'ship', 'none', 'exp'] },
		{ scheme: 'HQC-128', cells: ['ship', 'none', 'none', 'exp', 'none', 'planned'] },
		{ scheme: 'Classic McEliece', cells: ['ship', 'none', 'none', 'exp', 'none', 'planned'] },
		{ scheme: 'BIKE', cells: ['ship', 'none', 'none', 'exp', 'none', 'none'] },
		{ scheme: 'XMSS / LMS (stateful)', cells: ['ship', 'exp', 'none', 'ship', 'none', 'ship'] },
	];

	const cellMarkup = (s: CellState) => {
		const cls =
			s === 'ship'
				? 'impl-ship'
				: s === 'exp'
					? 'impl-exp'
					: s === 'planned'
						? 'impl-planned'
						: 'impl-none';
		const label =
			s === 'ship' ? 'shipped' : s === 'exp' ? 'experimental' : s === 'planned' ? 'planned' : '—';
		const glyph = s === 'ship' ? '✓' : s === 'exp' ? '◔' : s === 'planned' ? '·' : '—';
		return `<td class="impl-cell"><span class="impl-glyph ${cls}" title="${label}">${glyph}</span></td>`;
	};

	const body = rows
		.map(
			(r) =>
				`<tr><td><strong>${r.scheme}</strong></td>${r.cells.map(cellMarkup).join('')}</tr>`,
		)
		.join('');

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">In practice</p>
        <h2>Where Each Scheme Actually Ships</h2>
        <p class="section-footnote">
          Approximate status as of mid-2026 — check each library's current changelog before
          depending on these. <span class="impl-key"><span class="impl-glyph impl-ship">✓</span> shipped ·
          <span class="impl-glyph impl-exp">◔</span> experimental / behind a flag ·
          <span class="impl-glyph impl-planned">·</span> planned ·
          <span class="impl-glyph impl-none">—</span> not yet</span>
        </p>
      </div>
    </div>
    <div class="table-shell">
      <table class="math-table impl-table">
        <thead>
          <tr><th>Scheme</th>${LIBS.map((l) => `<th>${l}</th>`).join('')}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="section-footnote impl-footnote">
      OpenSSL 3.5 adds ML-KEM via providers; BoringSSL has shipped X25519+ML-KEM-768 hybrids
      since 2023. liboqs and the OQS provider are the most complete reference. For Java/.NET,
      BouncyCastle has the broadest direct support. <a href="https://openquantumsafe.org" target="_blank" rel="noopener noreferrer">openquantumsafe.org</a>
      tracks current status with version numbers.
    </p>
  `;

	return section;
}

// --- Section: live Lamport one-time signature (real SubtleCrypto SHA-256) -
// Lamport (1979) is the simplest possible hash-based signature. Per bit of
// message digest, the signer reveals one of two pre-committed 32-byte secrets.
// Verifying = hashing each revealed secret and matching it against the public
// half. This entire section runs real SHA-256 in the browser — students can
// open devtools, set a breakpoint, inspect actual bytes.
//
// One-time only: signing two messages reveals both halves at every position
// where the digests differ, which is the whole point of XMSS/LMS/SPHINCS+
// wrapping this construction in a Merkle / hypertree.

type LamportKeypair = { priv: Uint8Array[][]; pub: Uint8Array[][] };
type LamportSignature = Uint8Array[];

// crypto.subtle.digest expects BufferSource. TS 5.7+ types Uint8Array as
// Uint8Array<ArrayBufferLike> by default which isn't structurally assignable,
// so we route through a single cast helper rather than scattering them.
function asBuf(b: Uint8Array): BufferSource {
	return b as unknown as BufferSource;
}

async function lamportKeygen(): Promise<LamportKeypair> {
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

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest('SHA-256', asBuf(bytes)));
}

async function digestMessage(msg: string): Promise<Uint8Array> {
	return sha256(new TextEncoder().encode(msg));
}

function bitAt(digest: Uint8Array, i: number): 0 | 1 {
	return ((digest[i >> 3] >> (7 - (i & 7))) & 1) as 0 | 1;
}

async function lamportSign(kp: LamportKeypair, msg: string): Promise<{ sig: LamportSignature; digest: Uint8Array }> {
	const digest = await digestMessage(msg);
	const sig: LamportSignature = [];
	for (let i = 0; i < 256; i++) {
		sig.push(kp.priv[i][bitAt(digest, i)]);
	}
	return { sig, digest };
}

async function lamportVerify(
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

function shortHex(bytes: Uint8Array, n = 4): string {
	let out = '';
	for (let i = 0; i < Math.min(n, bytes.length); i++) out += bytes[i].toString(16).padStart(2, '0');
	return out + (bytes.length > n ? '…' : '');
}

function renderLamportDemo(): HTMLElement {
	const section = el('section', 'lab-section');

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Real crypto, live</p>
        <h2>One-Time Signatures in Your Browser</h2>
        <p class="section-footnote">
          Lamport (1979), the simplest hash-based signature — running real SHA-256 here in your browser. The 256-cell grid colours each digest bit by which key-half was revealed. Sign once, never again: the whole reason SPHINCS+ wraps OTS leaves in a hypertree and XMSS/LMS use a counter.
        </p>
      </div>
    </div>

    <div class="lamport-controls">
      <button type="button" id="lamport-gen" class="lamport-btn lamport-btn--primary">Generate keypair</button>
      <label class="lamport-msg-wrap">
        <span class="hero-metric-label">Message</span>
        <input type="text" id="lamport-msg" value="Hello, post-quantum world!" maxlength="200" />
      </label>
      <button type="button" id="lamport-sign" class="lamport-btn" disabled>Sign</button>
      <button type="button" id="lamport-verify" class="lamport-btn" disabled>Verify</button>
      <button type="button" id="lamport-tamper" class="lamport-btn lamport-btn--warn" disabled>Tamper &amp; verify</button>
    </div>

    <div class="lamport-stats">
      <div class="rec-line"><span class="rec-line-label">Private key</span><span class="rec-line-value mono-inline" id="lamport-priv">— · click "Generate" to start</span></div>
      <div class="rec-line"><span class="rec-line-label">Public key</span><span class="rec-line-value mono-inline" id="lamport-pub">—</span></div>
      <div class="rec-line"><span class="rec-line-label">Message digest</span><span class="rec-line-value mono-inline" id="lamport-digest">—</span></div>
      <div class="rec-line"><span class="rec-line-label">Signature</span><span class="rec-line-value mono-inline" id="lamport-sig">—</span></div>
      <div class="rec-line"><span class="rec-line-label">Verify</span><span class="rec-line-value" id="lamport-result">—</span></div>
    </div>

    <p class="section-kicker" style="margin-top:18px">Per-bit reveal pattern (256 bits of SHA-256 digest)</p>
    <div class="lamport-grid" id="lamport-grid" role="img" aria-label="Per-bit reveal grid"></div>

    <p class="lamport-warn">
      <strong>One-time only.</strong> Signing a second message with this keypair would, at every
      bit position where the two digests differ, reveal <em>both</em> private halves — enough for
      anyone to forge a signature on any future message. Stateful XMSS / LMS schedule a fresh leaf
      per signature; stateless SLH-DSA (SPHINCS+) samples a FORS few-time tree per message inside a
      WOTS+ hypertree.
    </p>
  `;

	const grid = section.querySelector('#lamport-grid') as HTMLElement;
	for (let i = 0; i < 256; i++) {
		const cell = el('span', 'lc');
		cell.dataset.idx = String(i);
		grid.appendChild(cell);
	}

	let kp: LamportKeypair | null = null;
	let lastSig: LamportSignature | null = null;
	let lastSigMsg: string | null = null;

	const genBtn = section.querySelector('#lamport-gen') as HTMLButtonElement;
	const signBtn = section.querySelector('#lamport-sign') as HTMLButtonElement;
	const verifyBtn = section.querySelector('#lamport-verify') as HTMLButtonElement;
	const tamperBtn = section.querySelector('#lamport-tamper') as HTMLButtonElement;
	const msgIn = section.querySelector('#lamport-msg') as HTMLInputElement;

	function paintDigestGrid(digest: Uint8Array | null, sigPresent: boolean, animate = false): void {
		const cells = grid.querySelectorAll<HTMLElement>('.lc');
		for (let i = 0; i < 256; i++) {
			const cell = cells[i];
			if (!digest) {
				cell.className = 'lc';
				cell.style.transitionDelay = '';
				continue;
			}
			const bit = bitAt(digest, i);
			// Staggered reveal: paint cells left-to-right, top-to-bottom over ~600 ms.
			cell.style.transitionDelay = animate ? `${i * 2}ms` : '';
			cell.className = `lc lc--bit${bit} ${sigPresent ? 'lc--revealed' : ''}`;
			cell.title = `bit ${i}: ${bit}${sigPresent ? ' — secret #' + bit + ' revealed' : ''}`;
		}
	}

	async function doGen(): Promise<void> {
		genBtn.disabled = true;
		genBtn.textContent = 'Generating…';
		const t0 = performance.now();
		kp = await lamportKeygen();
		const dt = performance.now() - t0;
		lastSig = null;
		lastSigMsg = null;
		(section.querySelector('#lamport-priv') as HTMLElement).textContent =
			`16,384 B · pos[0][0] = 0x${shortHex(kp.priv[0][0])} · keygen ${dt.toFixed(0)} ms`;
		(section.querySelector('#lamport-pub') as HTMLElement).textContent =
			`16,384 B · pos[0][0] = SHA-256(secret) = 0x${shortHex(kp.pub[0][0])}`;
		(section.querySelector('#lamport-digest') as HTMLElement).textContent = '—';
		(section.querySelector('#lamport-sig') as HTMLElement).textContent = '—';
		(section.querySelector('#lamport-result') as HTMLElement).textContent = '—';
		(section.querySelector('#lamport-result') as HTMLElement).className = 'rec-line-value';
		paintDigestGrid(null, false);
		signBtn.disabled = false;
		verifyBtn.disabled = true;
		tamperBtn.disabled = true;
		genBtn.disabled = false;
		genBtn.textContent = 'Generate keypair';
	}

	async function doSign(): Promise<void> {
		if (!kp) return;
		signBtn.disabled = true;
		const msg = msgIn.value;
		const t0 = performance.now();
		const { sig, digest } = await lamportSign(kp, msg);
		const dt = performance.now() - t0;
		lastSig = sig;
		lastSigMsg = msg;
		(section.querySelector('#lamport-digest') as HTMLElement).textContent =
			`SHA-256("${msg.length > 24 ? msg.slice(0, 24) + '…' : msg}") = 0x${shortHex(digest, 16)}`;
		(section.querySelector('#lamport-sig') as HTMLElement).textContent =
			`8,192 B · 256 revealed secrets · sign ${dt.toFixed(0)} ms`;
		(section.querySelector('#lamport-result') as HTMLElement).textContent = '—';
		(section.querySelector('#lamport-result') as HTMLElement).className = 'rec-line-value';
		paintDigestGrid(digest, true, true);
		verifyBtn.disabled = false;
		tamperBtn.disabled = false;
		signBtn.disabled = false;
	}

	async function doVerify(msgOverride?: string): Promise<void> {
		if (!kp || !lastSig) return;
		verifyBtn.disabled = true;
		tamperBtn.disabled = true;
		// Verify against what the user is *looking at* — the text box. Falling
		// back to lastSigMsg would mask manual edits and report ✓ for a message
		// the user has since changed, which defeats the point of the demo. The
		// Tamper button still drives doVerify(tampered) explicitly.
		const msg = msgOverride ?? msgIn.value;
		const t0 = performance.now();
		const { ok, digest } = await lamportVerify(kp.pub, msg, lastSig);
		const dt = performance.now() - t0;
		const result = section.querySelector('#lamport-result') as HTMLElement;
		const edited = lastSigMsg !== null && msg !== lastSigMsg;
		result.textContent = ok
			? `✓ valid · 256 SHA-256 comparisons in ${dt.toFixed(0)} ms`
			: edited
				? `✗ INVALID · message edited since signing (digest 0x${shortHex(digest)} ≠ signing digest)`
				: `✗ INVALID · digest 0x${shortHex(digest)} ≠ signing digest`;
		result.className = `rec-line-value ${ok ? 'lamport-ok' : 'lamport-bad'}`;
		paintDigestGrid(digest, true);
		verifyBtn.disabled = false;
		tamperBtn.disabled = false;
	}

	async function doTamper(): Promise<void> {
		if (lastSigMsg === null) return;
		// Flip the last character of the *currently displayed* message — keeps
		// the box and the verifier in lockstep so the user can see the change.
		const orig = msgIn.value;
		const tampered = orig.length
			? orig.slice(0, -1) + String.fromCharCode(orig.charCodeAt(orig.length - 1) ^ 1)
			: 'x';
		msgIn.value = tampered;
		await doVerify(tampered);
	}

	genBtn.addEventListener('click', () => void doGen());
	signBtn.addEventListener('click', () => void doSign());
	verifyBtn.addEventListener('click', () => void doVerify());
	tamperBtn.addEventListener('click', () => void doTamper());
	msgIn.addEventListener('input', () => {
		// Editing the message after signing means the stored signature no longer matches.
		// Clear verify status to avoid stale claims; user can re-sign for the new message.
		const result = section.querySelector('#lamport-result') as HTMLElement;
		if (result.textContent && result.textContent !== '—') {
			result.textContent = '— (message edited; sign again)';
			result.className = 'rec-line-value';
		}
	});

	return section;
}

// --- Section: stack recommender -------------------------------------------
type Need = 'both' | 'kem' | 'sig';
type Priority = 'primary' | 'diversity' | 'output' | 'pk';

interface Recommendation {
	kem?: string;
	sig?: string;
	hybrid: boolean;
	rationale: string;
	caveat?: string;
}

const NEEDS: { id: Need; label: string; description: string }[] = [
	{ id: 'both', label: 'Both', description: 'KEM + signature (TLS-style stack)' },
	{ id: 'kem', label: 'KEM only', description: 'Just key exchange / encryption' },
	{ id: 'sig', label: 'Signature only', description: 'Just digital signatures' },
];

const PRIORITIES: { id: Priority; label: string; description: string }[] = [
	{ id: 'primary', label: 'NIST primary', description: 'Default for most production systems' },
	{ id: 'diversity', label: 'Algorithmic diversity', description: 'Hedge against lattice problems being weakened' },
	{ id: 'output', label: 'Smallest output', description: 'Minimise ciphertext / signature bytes on wire' },
	{ id: 'pk', label: 'Smallest public key', description: 'Minimise the public-key size' },
];

const RECOMMENDATIONS: Record<string, Recommendation> = {
	'both:primary': {
		kem: 'ML-KEM-768 (Kyber)',
		sig: 'ML-DSA-65 (Dilithium)',
		hybrid: true,
		rationale: 'The default. Lattice-based ML-KEM and ML-DSA are NIST’s primary picks (FIPS 203 and 204) and have the broadest implementation support today. Adding a classical hybrid hedge is the recommended migration posture.',
	},
	'both:diversity': {
		kem: 'HQC-128',
		sig: 'SLH-DSA-128f (SPHINCS+)',
		hybrid: true,
		rationale: 'A non-lattice stack: HQC is the code-based KEM selected in 2025 and SLH-DSA is the hash-based signature in FIPS 205. If a future cryptanalytic advance weakens lattices, neither half of this stack falls.',
		caveat: 'SLH-DSA signatures are 17 KB and signing is slow — a deliberate cost of choosing a hash-only assumption.',
	},
	'both:output': {
		kem: 'ML-KEM-768 (Kyber)',
		sig: 'Falcon-512',
		hybrid: false,
		rationale: 'Falcon produces the smallest standardised PQC signatures (~666 B). Paired with ML-KEM, this is the wire-efficiency stack.',
		caveat: 'Falcon needs constant-time floating-point sampling — easy to get wrong in implementation.',
	},
	'both:pk': {
		kem: 'ML-KEM-768 (Kyber)',
		sig: 'SLH-DSA-128f (SPHINCS+)',
		hybrid: false,
		rationale: 'SLH-DSA public keys are just 32 B. Paired with ML-KEM (1.2 KB), the combined pk footprint is hard to beat without going to broken or research-only schemes.',
		caveat: 'You trade pk size for a 17 KB signature.',
	},
	'kem:primary': {
		kem: 'ML-KEM-768 (Kyber)',
		hybrid: true,
		rationale: 'NIST’s primary KEM (FIPS 203). Lattice-based, fast, with kilobyte-scale keys.',
	},
	'kem:diversity': {
		kem: 'HQC-128',
		hybrid: true,
		rationale: 'NIST-selected code-based KEM (2025), giving algorithmic diversity from lattice-based ML-KEM.',
	},
	'kem:output': {
		kem: 'Classic McEliece 348864',
		hybrid: false,
		rationale: 'McEliece ciphertexts are tiny (~96 B) and the scheme is unbroken since 1978 — the most conservative choice.',
		caveat: 'But the public key is ~255 KB. Only viable if you can pin keys ahead of time.',
	},
	'kem:pk': {
		kem: 'ML-KEM-768 (Kyber)',
		hybrid: true,
		rationale: 'Among unbroken KEMs, ML-KEM has the smallest public key (1184 B). SIKE was smaller but was broken in 2022.',
	},
	'sig:primary': {
		sig: 'ML-DSA-65 (Dilithium)',
		hybrid: true,
		rationale: 'NIST’s primary signature (FIPS 204). Lattice-based, fast verification, kilobyte-scale signatures.',
	},
	'sig:diversity': {
		sig: 'SLH-DSA-128f (SPHINCS+)',
		hybrid: true,
		rationale: 'Hash-based, stateless, minimal cryptographic assumptions. The conservative signature backup.',
		caveat: 'Signatures are 17 KB and signing is slow.',
	},
	'sig:output': {
		sig: 'Falcon-512',
		hybrid: false,
		rationale: 'The most compact standardised PQC signature (~666 B), well-suited to bandwidth-tight protocols.',
		caveat: 'Tricky constant-time sampling — use a vetted library.',
	},
	'sig:pk': {
		sig: 'SLH-DSA-128f (SPHINCS+)',
		hybrid: false,
		rationale: 'SLH-DSA public keys are only 32 B — the smallest of any standardised PQC signature.',
		caveat: 'Comes with 17 KB signatures.',
	},
};

function renderRecommender(): HTMLElement {
	const section = el('section', 'lab-section');

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Pick a stack</p>
        <h2>What Should You Use?</h2>
        <p class="section-footnote">Two questions, one recommendation. Use it as a starting point, not a verdict — your protocol, threat model, and library support matter too.</p>
      </div>
    </div>

    <div class="rec-grid">
      <div class="rec-question">
        <p class="hero-metric-label">What do you need?</p>
        <div class="rec-chips" data-group="need"></div>
      </div>
      <div class="rec-question">
        <p class="hero-metric-label">What matters most?</p>
        <div class="rec-chips" data-group="priority"></div>
      </div>
    </div>

    <div class="rec-result" id="rec-result"></div>
  `;

	const state: { need: Need; priority: Priority } = { need: 'both', priority: 'primary' };

	function chipFor<T extends string>(
		group: string,
		options: { id: T; label: string; description: string }[],
		current: T,
	): string {
		return options
			.map(
				(o) =>
					`<button type="button" role="radio" aria-checked="${o.id === current}" class="rec-chip ${o.id === current ? 'is-active' : ''}" data-group="${group}" data-id="${o.id}"><span class="rec-chip-label">${o.label}</span><span class="rec-chip-desc">${o.description}</span></button>`,
			)
			.join('');
	}

	function paint(): void {
		(section.querySelector('[data-group="need"]') as HTMLElement).innerHTML = chipFor(
			'need',
			NEEDS,
			state.need,
		);
		(section.querySelector('[data-group="priority"]') as HTMLElement).innerHTML = chipFor(
			'priority',
			PRIORITIES,
			state.priority,
		);

		const key = `${state.need}:${state.priority}`;
		const r = RECOMMENDATIONS[key];
		const result = section.querySelector('#rec-result') as HTMLElement;

		const kemLine = r.kem ? `<div class="rec-line"><span class="rec-line-label">KEM</span><span class="rec-line-value">${r.kem}</span></div>` : '';
		const sigLine = r.sig ? `<div class="rec-line"><span class="rec-line-label">Signature</span><span class="rec-line-value">${r.sig}</span></div>` : '';
		const hybridLine = `<div class="rec-line"><span class="rec-line-label">Hybrid hedge</span><span class="rec-line-value">${r.hybrid ? 'Recommended' : 'Optional'}</span></div>`;
		const caveat = r.caveat ? `<p class="rec-caveat">⚠ ${r.caveat}</p>` : '';
		const tryButton =
			r.kem && r.sig
				? `<button type="button" class="rec-try" data-kem="${r.kem}" data-sig="${r.sig}" data-hybrid="${r.hybrid}">Try this combo in the calculator ↑</button>`
				: '';

		result.innerHTML = `
      <div class="rec-card">
        <p class="section-kicker">Recommendation</p>
        <div class="rec-lines">${kemLine}${sigLine}${hybridLine}</div>
        <p class="panel-copy rec-rationale">${r.rationale}</p>
        ${caveat}
        ${tryButton}
      </div>
    `;
	}

	paint();

	section.addEventListener('click', (e) => {
		const target = e.target as HTMLElement;
		const chip = target.closest('.rec-chip') as HTMLButtonElement | null;
		if (chip) {
			const group = chip.dataset.group!;
			const id = chip.dataset.id!;
			if (group === 'need') state.need = id as Need;
			else if (group === 'priority') state.priority = id as Priority;
			paint();
			return;
		}
		const tryBtn = target.closest('.rec-try') as HTMLButtonElement | null;
		if (tryBtn) {
			window.dispatchEvent(
				new CustomEvent('pq-handshake-set', {
					detail: {
						kem: tryBtn.dataset.kem!,
						sig: tryBtn.dataset.sig!,
						hybrid: tryBtn.dataset.hybrid === 'true',
					},
				}),
			);
		}
	});

	return section;
}

// --- Section 4: info tabs (educational deep-dive) -------------------------
function renderInfoTabs(): HTMLElement {
	const section = el('section', 'lab-section');

	const categoriesTable = `
		<table class="math-table" style="min-width:0">
			<thead><tr><th>Cat</th><th>Effort floor</th><th>Pegged to</th><th>Where it shows up</th></tr></thead>
			<tbody>${SECURITY_CATEGORIES.map(
				(c) =>
					`<tr><td><strong>${c.level}</strong></td><td class="mono-cell">${c.floor}</td><td>${c.example}</td><td>${c.note}</td></tr>`,
			).join('')}</tbody>
		</table>`;

	const panels: Record<string, string> = {
		Shor: `<p>Peter Shor\u2019s 1994 quantum algorithm factors integers and computes discrete logarithms in polynomial time. That single result breaks RSA, Diffie\u2013Hellman, and elliptic-curve cryptography \u2014 the backbone of today\u2019s public-key security \u2014 once a sufficiently large, fault-tolerant quantum computer exists.</p><p>Post-quantum families are chosen precisely because no efficient quantum algorithm is known for their underlying problems. Grover\u2019s algorithm still gives a quadratic speedup against symmetric primitives, which is why AES-256 and SHA-384 remain recommended.</p><div class="callout"><p class="callout-title">How big a machine?</p><p>Gidney &amp; Eker\u00e5 (2019) estimate that factoring RSA-2048 with a surface code at a 10\u207b\u00b3 physical error rate needs \u2248 <strong>20 million noisy qubits</strong> and \u2248 <strong>8 hours</strong> of runtime. Current hardware is on the order of <strong>10\u00b3 noisy qubits</strong> with much higher error rates \u2014 the gap is several orders of magnitude, but it shrinks every year, and "harvest now, decrypt later" doesn't require parity today.</p></div>`,
		'Harvest now': `<p>\u201CHarvest now, decrypt later\u201D is the threat driving urgency today. An adversary can record encrypted traffic now and simply wait for a quantum computer to decrypt it years later. Any data that must stay secret beyond the arrival of quantum computing is already at risk.</p><p>This is why migration to ML-KEM and hybrid key exchange is happening before large quantum computers exist \u2014 the clock on long-lived secrets is already running.</p>`,
		'Why lattices won': `<p>Lattice schemes hit the sweet spot: kilobyte-scale keys, fast operations, strong security reductions, and the rare ability to support KEMs, signatures, and homomorphic encryption from one foundation. NIST made ML-KEM and ML-DSA its primary standards for exactly this balance.</p><p>Code-based and hash-based families serve as conservative, algorithmically diverse backups. Multivariate and isogeny finalists were broken outright in 2022, underscoring why diversity matters.</p>`,
		Hybrids: `<p>During migration, the safe move is to combine a classical algorithm with a post-quantum one so the result stays secure as long as either component holds. TLS deployments pairing X25519 with ML-KEM-768 are already widespread.</p><p>This hedges against two risks at once: an undiscovered flaw in a young PQC scheme, and the eventual arrival of quantum computers that break the classical half.</p>`,
		'NIST categories': `<p>NIST PQC parameter sets are pinned to one of five <em>security categories</em>, each defined by the classical and quantum effort needed to break a specific symmetric benchmark. The table is the headline summary; the underlying definitions are in NISTIR 8413 \u00A74.A.5.</p>${categoriesTable}<p style="margin-top:12px">Grover\u2019s quadratic speedup is folded into the quantum-effort column via a circuit-depth-bounded gate cost model \u2014 Grover with a constrained depth budget does not reach the na\u00EFve 2^(n/2) on AES-256, which is why Cat 5 remains at 2^200 quantum instead of 2^128.</p>`,
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

// --- Section: glossary ----------------------------------------------------
function renderGlossary(): HTMLElement {
	const section = el('section', 'lab-section');

	const items = GLOSSARY.map(
		(g) => `
    <div class="glossary-item">
      <p class="glossary-term">${g.term}</p>
      <p class="panel-copy glossary-def">${g.def}</p>
    </div>`,
	).join('');

	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Glossary</p>
        <h2>Terms in One Line Each</h2>
        <p class="section-footnote">Quick reference for the jargon used elsewhere in the lab. The references inside each family panel point to the canonical sources.</p>
      </div>
    </div>
    <div class="glossary-grid">${items}</div>
  `;

	return section;
}

function renderFooter(): HTMLElement {
	const footer = el('footer', 'lab-section');
	const reviewed = '2026-06';
	footer.innerHTML = `
    <div class="footer-meta">
      <div class="footer-meta-item">
        <p class="hero-metric-label">Last reviewed</p>
        <p class="mono-inline">${reviewed}</p>
      </div>
      <div class="footer-meta-item">
        <p class="hero-metric-label">Data provenance</p>
        <p class="panel-copy">Parameter sizes drawn from NIST FIPS 203 / 204 / 205, Falcon submission, and PQC round-4 specs. Cycle counts approximate Skylake reference-implementation numbers from SUPERCOP / eBATS. Implementation-status snapshot from each library's published changelog.</p>
      </div>
      <div class="footer-meta-item">
        <p class="hero-metric-label">Status</p>
        <p class="panel-copy">Educational use only. Figures are representative parameter sets \u2014 not deployment values. Use a vetted library (liboqs, BouncyCastle, .NET, BoringSSL) for production.</p>
      </div>
    </div>
    <p class="scripture">"So whether you eat or drink or whatever you do, do it all for the glory of God." \u2014 1 Corinthians 10:31</p>
  `;
	return footer;
}

// Audience modes give each reader a soft "priority view" of the page.
// "All" is the default. Each section declares which audiences it's primary
// for; non-primary sections fade slightly in focused modes, and primary
// sections get a subtle accent ribbon. Everything stays readable in every
// mode — this is reordering by emphasis, not by hiding.
type Audience = 'student' | 'engineer' | 'executive';

const SECTIONS: { id: string; label: string; render: () => HTMLElement; audience: Audience[] }[] = [
	{ id: 'section-families', label: 'Families', render: renderExplorer, audience: ['student', 'engineer', 'executive'] },
	{ id: 'section-recommend', label: 'Recommend', render: renderRecommender, audience: ['engineer', 'executive'] },
	{ id: 'section-handshake', label: 'Handshake', render: renderHandshakeCalculator, audience: ['engineer'] },
	{ id: 'section-lamport', label: 'Live sig', render: renderLamportDemo, audience: ['student'] },
	{ id: 'section-lattice', label: 'Lattice', render: renderLatticeViz, audience: ['student'] },
	{ id: 'section-isd', label: 'ISD bits', render: renderISDCalc, audience: ['student'] },
	{ id: 'section-sizes', label: 'Sizes', render: renderSizeChart, audience: ['engineer', 'executive'] },
	{ id: 'section-compare', label: 'Compare', render: renderTable, audience: ['engineer', 'executive'] },
	{ id: 'section-impl', label: 'Shipping', render: renderImplStatus, audience: ['engineer'] },
	{ id: 'section-timeline', label: 'Timeline', render: renderTimeline, audience: ['student', 'executive'] },
	{ id: 'section-context', label: 'Context', render: renderInfoTabs, audience: ['student'] },
	{ id: 'section-glossary', label: 'Glossary', render: renderGlossary, audience: ['student'] },
	{ id: 'section-remember', label: 'Remember', render: renderRemember, audience: ['student', 'engineer', 'executive'] },
];

const AUDIENCE_STORAGE_KEY = 'pq-audience';

function readAudience(): 'all' | Audience {
	const v = localStorage.getItem(AUDIENCE_STORAGE_KEY);
	if (v === 'student' || v === 'engineer' || v === 'executive' || v === 'all') return v;
	return 'all';
}

function writeAudience(v: 'all' | Audience): void {
	localStorage.setItem(AUDIENCE_STORAGE_KEY, v);
	document.documentElement.setAttribute('data-audience', v);
	document.querySelectorAll<HTMLButtonElement>('[data-audience-btn]').forEach((b) => {
		const active = b.dataset.audienceBtn === v;
		b.classList.toggle('is-active', active);
		b.setAttribute('aria-pressed', String(active));
	});
}

export function mountApp(root: HTMLDivElement): void {
	const shell = el('div', 'page-shell');

	shell.append(renderHero(), renderStartHere(), renderPinnedDrawer(), renderStickyNav());

	for (const sec of SECTIONS) {
		const node = sec.render();
		node.id = sec.id;
		node.dataset.navLabel = sec.label;
		node.dataset.audience = sec.audience.join(' ');
		shell.appendChild(node);
	}

	shell.appendChild(renderFooter());

	root.appendChild(shell);
	wireScrollReveals(shell);
	wireCopyLink(shell);
	wireStickyNav(shell);
	wireStartHereJumps(shell);
	wireAudience();
}

function wireAudience(): void {
	writeAudience(readAudience());
	document.querySelectorAll<HTMLButtonElement>('[data-audience-btn]').forEach((btn) => {
		btn.addEventListener('click', () => {
			writeAudience(btn.dataset.audienceBtn as 'all' | Audience);
		});
	});
}

// Fade sections in as they scroll into view. Respects prefers-reduced-motion
// via CSS (the reveal styles short-circuit when the user prefers no motion).
function wireScrollReveals(shell: HTMLElement): void {
	const sections = Array.from(shell.querySelectorAll<HTMLElement>('.lab-section'));
	sections.forEach((s) => s.classList.add('reveal-pending'));
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add('is-revealed');
					observer.unobserve(entry.target);
				}
			});
		},
		{ threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
	);
	sections.forEach((s) => observer.observe(s));
}

function wireCopyLink(shell: HTMLElement): void {
	const button = shell.querySelector<HTMLButtonElement>('#copy-link');
	if (!button) return;
	const original = button.innerHTML;
	button.addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(window.location.href);
			button.innerHTML = '<span aria-hidden="true">✓</span> Copied';
			button.classList.add('is-copied');
		} catch {
			button.innerHTML = '<span aria-hidden="true">!</span> Copy failed';
		}
		setTimeout(() => {
			button.innerHTML = original;
			button.classList.remove('is-copied');
		}, 1600);
	});
}

// --- Pinned schemes drawer ------------------------------------------------
// Stays hidden until at least one scheme is pinned, then expands with chips +
// "clear all" + "apply to handshake calc" (the last only when pins include a
// usable KEM + Signature pair).
function renderPinnedDrawer(): HTMLElement {
	const drawer = el('div', 'pinned-drawer');
	drawer.setAttribute('aria-live', 'polite');

	function paint(): void {
		const pins = getPins();
		if (pins.size === 0) {
			drawer.hidden = true;
			drawer.innerHTML = '';
			return;
		}
		drawer.hidden = false;

		const items = Array.from(pins)
			.map((name) => {
				const found = findSchemeByName(name);
				if (!found) return '';
				return `
        <span class="pin-chip">
          <span class="pin-chip-fam">${found.family.name}</span>
          <span class="pin-chip-name">${name}</span>
          <button type="button" class="pin-chip-x" data-unpin="${name}" aria-label="Unpin ${name}">×</button>
        </span>`;
			})
			.join('');

		// Find one KEM + one Signature to enable "Apply to handshake calc"
		let kemPin: string | undefined;
		let sigPin: string | undefined;
		for (const name of pins) {
			const f = findSchemeByName(name);
			if (!f) continue;
			if (f.scheme.kind === 'KEM' && !kemPin) kemPin = name;
			else if (f.scheme.kind === 'Signature' && !sigPin) sigPin = name;
		}
		const canApply = kemPin && sigPin;

		drawer.innerHTML = `
      <div class="pinned-drawer-inner">
        <p class="pinned-drawer-label">
          <span aria-hidden="true">📍</span>
          Pinned (${pins.size}) <span class="pinned-hint">— highlighted across the sizes chart and head-to-head table</span>
        </p>
        <div class="pinned-chips">${items}</div>
        <div class="pinned-actions">
          ${canApply ? `<button type="button" class="pin-apply" data-apply-kem="${kemPin}" data-apply-sig="${sigPin}">Apply to handshake calc ↓</button>` : ''}
          <button type="button" class="pin-clear">Clear all</button>
        </div>
      </div>
    `;
	}

	drawer.addEventListener('click', (e) => {
		const target = e.target as HTMLElement;
		const unpin = target.closest('[data-unpin]') as HTMLButtonElement | null;
		if (unpin) {
			togglePin(unpin.dataset.unpin!);
			return;
		}
		if (target.closest('.pin-clear')) {
			setPins(new Set());
			return;
		}
		const apply = target.closest('[data-apply-kem]') as HTMLButtonElement | null;
		if (apply) {
			window.dispatchEvent(
				new CustomEvent('pq-handshake-set', {
					detail: {
						kem: apply.dataset.applyKem!,
						sig: apply.dataset.applySig!,
						hybrid: false,
					},
				}),
			);
		}
	});

	window.addEventListener(PIN_EVENT, paint);
	paint();
	return drawer;
}

// --- Start-here strip -----------------------------------------------------
function renderStartHere(): HTMLElement {
	const strip = el('nav', 'start-here', '');
	strip.setAttribute('aria-label', 'Quick start');
	strip.innerHTML = `
    <p class="start-eyebrow">Start here</p>
    <div class="start-grid">
      <a href="#section-families" class="start-card" data-jump="section-families">
        <span class="start-card-num">1</span>
        <span class="start-card-title">Compare the families</span>
        <span class="start-card-sub">Five families, side by side: math, sizes, attacks, references.</span>
      </a>
      <a href="#section-lamport" class="start-card start-card--accent" data-jump="section-lamport">
        <span class="start-card-num">2</span>
        <span class="start-card-title">See a signature run live</span>
        <span class="start-card-sub">Real SHA-256 Lamport keygen + sign + verify in your browser.</span>
      </a>
      <a href="#section-recommend" class="start-card" data-jump="section-recommend">
        <span class="start-card-num">3</span>
        <span class="start-card-title">Get a recommended stack</span>
        <span class="start-card-sub">Two questions → KEM + signature with rationale and a try-it button.</span>
      </a>
    </div>
  `;
	return strip;
}

function wireStartHereJumps(shell: HTMLElement): void {
	shell.querySelectorAll<HTMLAnchorElement>('[data-jump]').forEach((a) => {
		a.addEventListener('click', (e) => {
			const id = a.dataset.jump!;
			const target = document.getElementById(id);
			if (!target) return;
			e.preventDefault();
			target.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	});
}

// --- Sticky section nav ---------------------------------------------------
function renderStickyNav(): HTMLElement {
	const nav = el('nav', 'sticky-nav', '');
	nav.setAttribute('aria-label', 'Section navigation');
	const audienceOptions: { id: 'all' | Audience; label: string; title: string }[] = [
		{ id: 'all', label: 'All', title: 'Show every section without emphasis' },
		{ id: 'student', label: 'Student', title: 'Highlight live demos, intuition, glossary' },
		{ id: 'engineer', label: 'Engineer', title: 'Highlight wire sizes, handshake, shipping status' },
		{ id: 'executive', label: 'Executive', title: 'Highlight recommendation, head-to-head, takeaways' },
	];
	nav.innerHTML = `
    <div class="sticky-nav-inner">
      <div class="audience-picker" role="group" aria-label="Audience focus">
        ${audienceOptions
					.map(
						(o) =>
							`<button type="button" class="audience-btn" data-audience-btn="${o.id}" title="${o.title}" aria-pressed="false">${o.label}</button>`,
					)
					.join('')}
      </div>
      <span class="sticky-nav-divider" aria-hidden="true"></span>
      ${SECTIONS.map(
				(s) =>
					`<a href="#${s.id}" data-nav="${s.id}" class="sticky-nav-link">${s.label}</a>`,
			).join('')}
    </div>
  `;
	return nav;
}

function wireStickyNav(shell: HTMLElement): void {
	const links = Array.from(shell.querySelectorAll<HTMLAnchorElement>('.sticky-nav-link'));
	if (links.length === 0) return;
	const byId = new Map(links.map((a) => [a.dataset.nav!, a]));

	links.forEach((a) => {
		a.addEventListener('click', (e) => {
			const target = document.getElementById(a.dataset.nav!);
			if (!target) return;
			e.preventDefault();
			target.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	});

	// Light up the section that occupies the largest share of the viewport.
	const sections = Array.from(shell.querySelectorAll<HTMLElement>('.lab-section'));
	let activeId: string | null = null;
	function setActive(id: string | null): void {
		if (id === activeId) return;
		activeId = id;
		links.forEach((a) => a.classList.toggle('is-active', a.dataset.nav === id));
	}
	const observer = new IntersectionObserver(
		() => {
			// Find the section closest to the top of viewport that's at least partially visible
			let best: { id: string; dist: number } | null = null;
			for (const sec of sections) {
				const r = sec.getBoundingClientRect();
				if (r.bottom < 80 || r.top > window.innerHeight - 80) continue;
				const dist = Math.abs(r.top - 80);
				if (!best || dist < best.dist) best = { id: sec.id, dist };
			}
			setActive(best?.id ?? null);
			if (best && byId.has(best.id)) {
				const link = byId.get(best.id)!;
				// Keep the active link in view inside the horizontally scrollable rail
				link.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
			}
		},
		{ threshold: [0, 0.1, 0.25, 0.5, 0.75, 1], rootMargin: '-80px 0px -40% 0px' },
	);
	sections.forEach((s) => observer.observe(s));
}

// --- "Remember 4 things" closer -------------------------------------------
function renderRemember(): HTMLElement {
	const section = el('section', 'lab-section');
	section.innerHTML = `
    <div class="section-heading-row">
      <div>
        <p class="section-kicker">Land the arc</p>
        <h2>If You Remember Only Four Things</h2>
        <p class="section-footnote">The page is long. The takeaways aren't.</p>
      </div>
    </div>
    <ol class="remember-list">
      <li class="remember-item">
        <span class="remember-num">1</span>
        <div class="remember-body">
          <p class="remember-title">Lattices are the default production answer today.</p>
          <p class="panel-copy">ML-KEM and ML-DSA are NIST's primary KEM and signature (FIPS 203 / 204). Falcon ships compact signatures (FIPS 206 / FN-DSA). Together they cover almost every protocol.</p>
        </div>
      </li>
      <li class="remember-item">
        <span class="remember-num">2</span>
        <div class="remember-body">
          <p class="remember-title">Code- and hash-based families are the diversity hedge.</p>
          <p class="panel-copy">HQC (FIPS, selected 2025) and SLH-DSA / SPHINCS+ (FIPS 205) exist precisely so a future cryptanalytic advance against lattices wouldn't take the whole portfolio with it.</p>
        </div>
      </li>
      <li class="remember-item">
        <span class="remember-num">3</span>
        <div class="remember-body">
          <p class="remember-title">Two finalist families were broken in a single year — 2022.</p>
          <p class="panel-copy">Rainbow (multivariate) fell to Beullens's rectangular MinRank attack; SIKE (isogeny) fell to Castryck–Decru via Kani's theorem. "Post-quantum" is a moving target.</p>
        </div>
      </li>
      <li class="remember-item">
        <span class="remember-num">4</span>
        <div class="remember-body">
          <p class="remember-title">Hybrid is the practical deployment posture, now.</p>
          <p class="panel-copy">Pair a classical scheme (X25519, ECDSA) with a PQC scheme so the joint construction stays secure as long as either component holds. Cloudflare and Google already ship X25519 + ML-KEM-768.</p>
        </div>
      </li>
    </ol>
  `;
	return section;
}
