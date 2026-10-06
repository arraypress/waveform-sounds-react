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
	/* While the core is a `file:../waveform-sounds` devDependency, npm
	 * symlinks it, Vite follows the link to its real path — outside this
	 * root — and refuses `option-surface.ts`'s `?raw` read of its
	 * `index.d.ts`. Allow that one sibling. Harmless (and removable) once
	 * the devDependency is `^0.1.0` from npm. */
	server: { fs: { allow: ['.', '../waveform-sounds'] } },
	test: {
		include: ['test/**/*.test.{ts,tsx}'],
		environment: 'jsdom',
		globals: false,
		setupFiles: ['./test/setup.ts'],
	},
});
