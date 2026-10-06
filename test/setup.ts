/**
 * test/setup.ts
 * -------------
 *
 * Per-suite setup imported by Vitest. Brings in
 * `@testing-library/jest-dom`'s expect matchers so tests can use
 * `expect(el).toBeInTheDocument()` and friends without re-adding the
 * import in every file.
 *
 * Deliberately does NOT install a `window.WaveformPlayer`: the sounds core
 * only needs one when something plays, and the integration tests hand it
 * a stand-in through `playerClass` (see `test/engine.ts`) — the documented
 * ESM path — so a test can't pass by accident on a global.
 */
import '@testing-library/jest-dom/vitest';
