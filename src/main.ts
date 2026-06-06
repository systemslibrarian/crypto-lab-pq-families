import './style.css';
import './extra.css';
import { FAMILIES, formatBytes } from './data.ts';
import { mountApp } from './ui.ts';

// Dev-only self-test: surface the corpus in the console for quick verification.
// Stripped from production builds so the deployed console stays clean.
if (import.meta.env.DEV) {
	console.group('crypto-lab-pq-families: data self-test');
	console.log('Families loaded:', FAMILIES.length);
	console.table(
		FAMILIES.map((f) => ({
			family: f.name,
			problem: f.hardProblem,
			status: f.maturity,
			confidence: f.confidence,
			schemes: f.schemes.length,
			minPubKey: formatBytes(Math.min(...f.schemes.map((s) => s.pubKey))),
			maxPubKey: formatBytes(Math.max(...f.schemes.map((s) => s.pubKey))),
		})),
	);
	const broken = FAMILIES.filter((f) => f.maturity === 'broken').map((f) => f.name);
	console.log('Broken families (historical):', broken.join(', '));
	console.groupEnd();
}

mountApp(document.querySelector<HTMLDivElement>('#app')!);

(function initThemeToggle() {
	const button = document.getElementById('theme-toggle') as HTMLButtonElement | null;
	if (!button) return;

	function apply(theme: string): void {
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
		const isDark = theme === 'dark';
		button!.textContent = isDark ? '\u{1F319}' : '\u2600\uFE0F';
		button!.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
	}

	const current = document.documentElement.getAttribute('data-theme') ?? 'dark';
	apply(current);

	button.addEventListener('click', () => {
		const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
		apply(next);
	});
})();
