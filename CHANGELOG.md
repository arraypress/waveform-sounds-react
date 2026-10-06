# Changelog

All notable changes to `@arraypress/waveform-sounds-react` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

## [0.1.0] — 2026-10-06

### Added

- First release: `<WaveformSounds />`, a React wrapper for
  `@arraypress/waveform-sounds` 0.1.0 (built against its post-52f5269
  contract: the list builds after the constructor returns, and `destroy()`
  leaves adopted markup and the host's server-rendered classes alone; its
  type / key / sort controls are searchable `[data-ws-menu]` dropdowns).
- Theming through `style`: the list is colour-agnostic by default; set
  `--ws-surface` for the server-rendered first paint.
- Server-rendered markup: with `sounds`, the host's inner HTML is the core's
  own `renderSounds()` output (from the DOM-free `/render` entry), so the
  list is in the first render — SSR included — and the runtime adopts those
  rows instead of rebuilding them. With only `manifest`, the host is empty
  and the runtime fetches and builds the list. The host carries
  `wfp-host waveform-sounds waveform-sounds--<player>` from the first render
  (styled before hydration) and never `data-waveform-sounds` (the global
  auto-init must not double-mount).
- Every `WaveformSoundsOptions` key as a prop, typed from the core's
  `index.d.ts`; forwarded through an explicit allowlist with a drift test
  (`test/forwarding-drift.test.tsx`) that fails when the core adds an
  option the wrapper doesn't forward. Includes the core's `sorts`
  (`[]` = no sort menu; the first usable order is the starting one),
  `showCount` and `menuSearch` (core beadf0f — `sortable` is gone), all of
  which shape the server-rendered markup too.
- `idPrefix` for the dropdowns' element ids (core 7591952), always passed
  to both the renderer and the runtime: the prop, else the `id` prop, else
  a sanitised `useId()` — unique per list (the core's own fallback is a
  hash of the sounds, so two lists of the same sounds would collide) and
  identical on the server and the client, so the adopted markup hydrates
  without a mismatch.
- `urlState` (core 8d7db3b): filters and sort kept in the address. A
  runtime-only option — the server markup is the unfiltered list, and the
  runtime applies the address on load. Re-mounts on change like the rest.
- Per-sound `download` links flow through `sounds` into the rendered rows
  (`SoundInput` is the core's type, so no wrapper change was needed).
- Re-mount on any option change. `sounds`, `filters`, `sorts`, `columns`,
  `strings` and `playerOptions` compare by value, so inline literals don't re-mount
  on every render. After `destroy()` the wrapper restores the freshly
  rendered markup, so the new instance never adopts rows carrying the old
  one's sort order, hidden rows, playing state or control values.
- Callback props `onReady`, `onPlay`, `onPause`, `onEnd`, `onFilter`,
  `onError`, plus function values inside `playerOptions`, are passed as
  stable trampolines that call the latest handler, so a new handler never
  re-mounts. The ref is live by the time `onReady` / the first `onFilter`
  fire.
- `WaveformSoundsHandle` via `ref`: `play`, `pause`, `toggle`, `next`,
  `previous`, `setFilter`, `clearFilters`, `setSort`, `setLoop`,
  `showMore`, and `instance`.
- SSR / RSC safe: the runtime (`/no-autoinit`) is imported dynamically
  inside `useEffect`, once per page, and nothing touches `window` at
  import. StrictMode's replayed effect constructs exactly one instance.
- Tests: mocked-boundary unit tests, an integration suite against the
  real core (adoption, callbacks from the core's play / filter paths, the
  ref, re-mounts), a Node-environment SSR test, peer-floor and type tests.

### Peer dependencies

- `@arraypress/waveform-sounds` `^0.1.0`
- `@arraypress/waveform-player` `^1.24.5`
- `react` `^18.0.0 || ^19.0.0`
