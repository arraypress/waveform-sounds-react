/**
 * vitest.config.ts
 * ----------------
 *
 * Vitest configuration for the React wrapper. Uses `jsdom` so we get a
 * fake DOM to mount React components into.
 *
 * Two kinds of test file:
 *   - `WaveformSounds.test.tsx` / `forwarding-drift.test.tsx` mock the
 *     runtime entry (`@arraypress/waveform-sounds/no-autoinit`) at the
 *     module boundary, to assert exactly what the wrapper hands the
 *     constructor and when it constructs / destroys.
 *   - `integration.test.tsx` runs the REAL sounds core (it builds its rows
 *     fine in jsdom) with a stand-in engine passed as `playerClass` — the
 *     real `WaveformPlayer` needs Web Audio / Canvas jsdom lacks. That is
 *     where markup adoption, the `waveformsounds:*` callbacks and the
 *     imperative handle are checked end to end.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['test/**/*.test.{ts,tsx}'],
		environment: 'jsdom',
		globals: false,
		setupFiles: ['./test/setup.ts'],
	},
});
