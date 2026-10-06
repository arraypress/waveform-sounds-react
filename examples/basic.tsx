/**
 * examples/basic.tsx
 * ------------------
 *
 * Reference React components for every <WaveformSounds> usage pattern this
 * package supports. Copy/paste into your own React app (Vite, Next.js,
 * Remix, anywhere).
 *
 * Library setup (do this ONCE in your app entry — `main.tsx` or your root
 * layout):
 *
 *   // Stylesheets for both cores
 *   import '@arraypress/waveform-player/styles.css';
 *   import '@arraypress/waveform-sounds/styles.css';
 *
 *   // The list plays through one WaveformPlayer, constructed on first play
 *   // from `window.WaveformPlayer`. Importing the player core registers it:
 *   import '@arraypress/waveform-player';
 *
 * The wrapper does NOT import CSS or the player for you — you might prefer
 * a CDN, a self-hosted asset, or passing the class as `playerClass`.
 */
import { useRef, useState } from 'react';
import WaveformPlayer from '@arraypress/waveform-player'; // Example 6
import {
	WaveformSounds,
	type SoundInput,
	type WaveformSoundsHandle,
} from '@arraypress/waveform-sounds-react';

const PACK: SoundInput[] = [
	{ url: '/previews/bass-01.mp3', title: 'Bass Loop 01', type: 'Bass', bpm: 128, key: 'F minor', duration: 8, peaks: '20406080a0806040' },
	{ url: '/previews/drum-01.mp3', title: 'Drum Loop 01', type: 'Drums', bpm: 140, duration: 4 },
	{ url: '/previews/pad-01.mp3', title: 'Warm Pad', type: 'Pads', key: 'C', duration: 16, tags: ['ambient', 'analog'] },
	{ url: '/previews/crash.mp3', title: 'Crash', type: 'One-shots', id: 'crash' },
];

/* Example 1 — A sample pack, server-rendered (the list is in the HTML) */
export function PackExample() {
	return <WaveformSounds sounds={PACK} />;
}

/* Example 2 — From a waveform-gen manifest (built client-side once fetched)
 *   npx @arraypress/waveform-gen ./previews/*.mp3 --manifest ./public/sounds.json */
export function ManifestExample() {
	return <WaveformSounds manifest="/sounds.json" pageSize={100} />;
}

/* Example 3 — The docked "strip" player, fewer controls (Name/BPM sort only,
 * no count), translated strings */
export function StripExample() {
	return (
		<WaveformSounds
			sounds={PACK}
			player="strip"
			filters={['type']}
			columns={['bpm', 'duration']}
			sorts={['title', 'bpm']}
			showCount={false}
			loopToggle={false}
			strings={{ count: '{count} geluiden', searchPlaceholder: 'Zoek geluiden…' }}
			playerOptions={{ height: 56, waveformStyle: 'bars' }}
		/>
	);
}

/* Example 4 — Callbacks: what's playing, and how many match */
export function CallbacksExample() {
	const [playing, setPlaying] = useState<string | null>(null);
	const [matches, setMatches] = useState(PACK.length);

	return (
		<div>
			<p>
				{playing ? `Playing: ${playing}` : 'Nothing playing'} · {matches} match
			</p>
			<WaveformSounds
				sounds={PACK}
				onPlay={(sound) => setPlaying(sound.title)}
				onPause={() => setPlaying(null)}
				onFilter={(visible) => setMatches(visible.length)}
			/>
		</div>
	);
}

/* Example 5 — Imperative control via ref (no re-mount, playback continues) */
export function RefExample() {
	const ref = useRef<WaveformSoundsHandle>(null);
	const [loop, setLoop] = useState(false);

	return (
		<div>
			<div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
				<button onClick={() => ref.current?.setFilter({ type: 'Bass' })}>Bass only</button>
				<button onClick={() => ref.current?.clearFilters()}>All</button>
				<button onClick={() => ref.current?.setSort('bpm')}>Sort by BPM</button>
				<button onClick={() => ref.current?.play('crash')}>Play the crash</button>
				<button onClick={() => ref.current?.next()}>Next</button>
				<button
					onClick={() => {
						// setLoop on the ref, not a `loop` prop: changing a prop
						// re-creates the list (and stops the sound).
						ref.current?.setLoop(!loop);
						setLoop(!loop);
					}}
				>
					Loop {loop ? 'on' : 'off'}
				</button>
			</div>
			<WaveformSounds ref={ref} sounds={PACK} />
		</div>
	);
}

/* Example 6 — ESM without the global: pass the player class */
export function PlayerClassExample() {
	return <WaveformSounds sounds={PACK} playerClass={WaveformPlayer} />;
}
