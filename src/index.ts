/**
 * @module @arraypress/waveform-sounds-react
 * @description
 * Public entry point for the React wrapper around
 * `@arraypress/waveform-sounds`.
 *
 * ```tsx
 * import '@arraypress/waveform-player'; // the engine: window.WaveformPlayer
 * import { WaveformSounds } from '@arraypress/waveform-sounds-react';
 *
 * function App() {
 *   return (
 *     <WaveformSounds
 *       sounds={[
 *         { url: '/s/bass-01.mp3', title: 'Bass Loop 01', type: 'Bass', bpm: 128, key: 'Fm' },
 *         { url: '/s/drum-01.mp3', title: 'Drum Loop 01', type: 'Drums', bpm: 140 },
 *       ]}
 *     />
 *   );
 * }
 * ```
 *
 * ## Types
 *
 * ```ts
 * import type {
 *   WaveformSoundsProps,
 *   WaveformSoundsHandle,
 *   WaveformSoundsOptions,
 *   WaveformSoundsStrings,
 *   WaveformSoundsEventMap,
 *   SoundInput,
 *   Sound,
 *   SoundsManifest,
 *   SoundsFilter,
 *   SoundsSort,
 *   SoundsLayout,
 *   SoundsFilterControl,
 *   SoundsLoopFilter,
 *   SoundsColumn,
 * } from '@arraypress/waveform-sounds-react';
 * ```
 */

export { WaveformSounds } from './WaveformSounds';
export { WaveformSounds as default } from './WaveformSounds';

export type {
	WaveformSoundsProps,
	WaveformSoundsHandle,
	WaveformSoundsOptions,
	WaveformSoundsStrings,
	WaveformSoundsEventMap,
	SoundInput,
	Sound,
	SoundsManifest,
	SoundsFilter,
	SoundsSort,
	SoundsLayout,
	SoundsFilterControl,
	SoundsLoopFilter,
	SoundsColumn,
} from './types';
