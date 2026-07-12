import { defineConfig } from 'vitest/config';

// Unit tests for the crypto/math primitives in src/crypto.ts. The Playwright
// accessibility suite lives in e2e/ and is run separately via `npm run
// test:a11y`; it must NOT be collected here (Playwright's `test` API is
// incompatible with Vitest's runner).
export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
	},
});
