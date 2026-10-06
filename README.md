<div align="center">

# Waveform Sounds for React

**React component wrapper for `@arraypress/waveform-sounds`.**
A searchable, filterable sound list — server-rendered, then adopted by the runtime — with typed props, callback props and an imperative ref handle.

[![npm version](https://img.shields.io/npm/v/@arraypress/waveform-sounds-react?style=flat-square&labelColor=09090b&color=3f3f46)](https://www.npmjs.com/package/@arraypress/waveform-sounds-react)
[![license](https://img.shields.io/npm/l/@arraypress/waveform-sounds-react?style=flat-square&labelColor=09090b&color=3f3f46)](https://github.com/arraypress/waveform-sounds-react/blob/main/LICENSE)

**[Documentation](https://docs.waveformplayer.com/)** · [npm](https://www.npmjs.com/package/@arraypress/waveform-sounds-react)

</div>

---

## Install

```bash
npm install @arraypress/waveform-sounds-react @arraypress/waveform-sounds @arraypress/waveform-player react
```

Once, at your app entry:

```ts
import '@arraypress/waveform-player';            // the audio engine (window.WaveformPlayer)
import '@arraypress/waveform-player/styles.css';
import '@arraypress/waveform-sounds/styles.css';
```

```tsx
import { WaveformSounds } from '@arraypress/waveform-sounds-react';

<WaveformSounds
  sounds={[
    { url: '/s/bass-01.mp3', title: 'Bass Loop 01', type: 'Bass', bpm: 128, key: 'Fm' },
    { url: '/s/drum-01.mp3', title: 'Drum Loop 01', type: 'Drums', bpm: 140 },
  ]}
  onPlay={(sound) => console.log(sound.title)}
/>
```

Or from a [`waveform-gen`](https://www.npmjs.com/package/@arraypress/waveform-gen) manifest: `<WaveformSounds manifest="/sounds.json" />`.

## Props

Every `WaveformSoundsOptions` key from the core is a prop, typed from the
core's own `index.d.ts` — `sounds` / `manifest`, `player`, `search`, `filters`,
`sorts`, `showCount`, `menuSearch`, `idPrefix`, `loopToggle`, `maxTypeChips`, `pageSize`, `columns`,
`waveformStyle`, `waveformColor`, `progressColor`, `barWidth`, `barGap`,
`loop`, `autoAdvance`, `arrowAudition`, `playerOptions`, `playerClass`,
`strings` — plus the callbacks `onReady` / `onPlay` / `onPause` / `onEnd` /
`onFilter` / `onError`, and `id` / `className` / `style` for the host.

- **With `sounds`, the whole list is in the first render** (server HTML
  included); the runtime adopts it on the client instead of rebuilding it.
  With only `manifest`, the list is fetched and built client-side.
- **Dropdown ids are unique per list and stable across hydration**: the
  `idPrefix` prop, else the `id` prop, else one from React's `useId()`. Two
  lists of the same sounds on one page never share ids.
- **A changed option re-creates the list** (arrays and objects compare by
  value, so inline literals are fine). A changed callback never does.
- **Live changes without a re-mount** go through the ref.

## Theming

Colour-agnostic by default — everything derives from `currentColor`, so it
fits light and dark pages with no setup. For server-rendered pages set
`--ws-surface` (the page background, otherwise detected at runtime) so the
first paint is right:

```tsx
<WaveformSounds sounds={sounds} style={{ '--ws-surface': '#0a0a0a' } as React.CSSProperties} />
```

`--ws-accent` / `--ws-on-accent` opt into a brand colour; the rest of the
`--ws-*` properties are listed in the core's README.

## Ref

```tsx
const ref = useRef<WaveformSoundsHandle>(null);

<WaveformSounds ref={ref} sounds={sounds} />
<button onClick={() => ref.current?.setFilter({ type: 'Bass' })}>Bass</button>
```

`play(target?, { at? })`, `pause()`, `toggle(target?)`, `next()`,
`previous()`, `setFilter(patch)`, `clearFilters()`, `setSort(by)`,
`setLoop(on)`, `showMore()`, and `instance` (the core `WaveformSounds`, or
`null` before it mounts).

## Documentation

### -> [docs.waveformplayer.com](https://docs.waveformplayer.com/)

## License

MIT © [ArrayPress](https://github.com/arraypress)
