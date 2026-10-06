# CLAUDE.md — @arraypress/waveform-sounds-react

React wrapper for `@arraypress/waveform-sounds`. Server-renders the list with
the core's own `renderSounds()` (`/render`), constructs `WaveformSounds` from
`/no-autoinit` over that host on mount (the runtime adopts the rows), and
exposes a `WaveformSoundsHandle` via `ref`.

## Commands
- `npm test` — vitest + jsdom (run before committing).
- `npm run typecheck` — `tsc --noEmit`, including `test/types.typecheck.ts`.
- `npm run build` — tsup to `dist/`. `prepublishOnly` runs it. `dist/` is gitignored.

## ⚠️ The core is a `file:` devDependency until it publishes
`@arraypress/waveform-sounds` 0.1.0 is not on npm yet, so the devDependency is
`file:../waveform-sounds` (npm symlinks it). **After the core publishes,
switch it to `^0.1.0`, `npm install`, and drop the `server.fs.allow` entry in
`vitest.config.ts`** (it only exists because Vite refuses the `?raw` read of
the symlinked core's `index.d.ts` outside this root). Publish order: core
first, then this.

## The rule that matters: two edits per option, both manual
`src/WaveformSounds.tsx`. A new core option needs:
1. `if (props.<key> !== undefined) opts.<key> = props.<key>;` in `buildSoundsOptions`.
2. `props.<key>,` (or a `valueKey()` for an array / object) in the mount
   effect's deps array.
3. If it changes the MARKUP (a `RENDER_DEFAULTS` key in the core's
   `render.js`), also pass it to `renderSounds` and add it to the `html`
   memo's deps — or the server rows won't match what the runtime expects.

The props TYPE is free (`extends WaveformSoundsOptions`). `test/forwarding-drift.test.tsx`
fails until (1) and (2) are done, or the key is listed in `NOT_FORWARDED`
with a reason (empty today — every option is forwarded). It reads the
option list from the installed core's `index.d.ts`, so after a core release
bump the devDependency or the test can't see the new option.

## Design decisions
- **Markup via `dangerouslySetInnerHTML`.** React treats it as opaque, so it
  never reconciles the rows the runtime re-orders / hides. The `{__html}`
  object is memoised: React 19 rewrites `innerHTML` whenever that object's
  identity changes, which would wipe the live rows.
- **Host classes frozen at first render** (as in waveform-playlist-react):
  the runtime adds/removes `waveform-sounds--<player>`; later `className`
  changes go through `classList`.
- **Re-mount resets the markup.** By the core's documented contract
  (since 52f5269), `destroy()` leaves ADOPTED rows in place with the old
  state on them (order, `hidden`, `is-playing`, control values) — "to start
  again, re-render it". The effect cleanup rewrites `htmlRef.current` after
  `destroy()`, before the next instance constructs (same as the Svelte
  wrapper). Tested both mocked and against the real core — remove it and
  two tests fail.
- **One shared runtime import** (`loadRuntime()`), reset on failure. Also
  works around a Vitest 4.1 mocker bug: the second of two CONCURRENT
  dynamic imports of a `vi.mock`ed module returns the REAL module, which
  broke the StrictMode test.
- **Callbacks are trampolines** reading `callbacksRef`; `playerOptions`
  function values too. The core builds on a microtask AFTER `new` returns
  (since 52f5269), so `instanceRef` is set before `onFilter` / `onReady`
  fire and a handler can use the ref.
- **`idPrefix` is always resolved and passed** (prop → `id` → sanitised
  `useId()`) to `renderSounds` AND the constructor. Never derive it from
  anything that differs between server and client (random, counters):
  the hydration test in `WaveformSounds.test.tsx` fails if you do.
- **Host classes**: the host renders `waveform-sounds waveform-sounds--<player>`
  itself, so the core (which only adds classes the host lacks, and only
  removes those on destroy) never touches them; the layout-class swap on a
  `player` change is the wrapper's `syncHostClasses`.
- **The player is the user's**: import `@arraypress/waveform-player` for its
  global, or pass `playerClass`. The wrapper doesn't import it (same as
  waveform-playlist-react).

## Tests
- `WaveformSounds.test.tsx` + `forwarding-drift.test.tsx` — runtime mocked.
- `integration.test.tsx` — the REAL core, with `test/engine.ts` as `playerClass`.
- `ssr.test.tsx` — `// @vitest-environment node`, `renderToString`.
- `peer-ranges.test.ts`, `types.typecheck.ts`.

## Cross-repo
One of the four `waveform-sounds-*` wrappers. The sounds group is not yet in
the `waveform-release` skill's package list — add it there on first publish
(core → wrappers).
