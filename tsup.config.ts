/**
 * tsup.config.ts
 * --------------
 *
 * Build configuration for `@arraypress/waveform-sounds-react`.
 *
 * Outputs:
 *   - dist/index.js   (ESM)   — for modern bundlers and Node `import`
 *   - dist/index.cjs  (CJS)   — for older toolchains and Node `require`
 *   - dist/index.d.ts         — TypeScript declarations
 *
 * Externalises `react` and the `@arraypress/waveform-*` cores (including
 * the sounds core's `/render` and `/no-autoinit` subpaths) so they resolve
 * to the consumer's installed copies, never bundled in.
 */
import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	sourcemap: true,
	clean: true,
	treeshake: true,
	external: [
		'react',
		'react-dom',
		'@arraypress/waveform-player',
		'@arraypress/waveform-sounds',
		'@arraypress/waveform-sounds/render',
		'@arraypress/waveform-sounds/no-autoinit',
	],
});
