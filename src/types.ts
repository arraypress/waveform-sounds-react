/**
 * @module types
 * @description
 * Public TypeScript types for `@arraypress/waveform-sounds-react`.
 *
 * The option surface is owned by the core, `@arraypress/waveform-sounds`,
 * whose hand-written `index.d.ts` declares {@link WaveformSoundsOptions}.
 * The props here are DERIVED from it rather than re-declared, so the types
 * can never drift from the core. (The runtime forwarding in
 * `WaveformSounds.tsx` is a hand-written allowlist — that CAN drift, which
 * is what `test/forwarding-drift.test.tsx` guards.)
 *
 * This module only adds the React-specific surface:
 *
 *   - DOM pass-through (`id`, `className`, `style`).
 *   - A {@link WaveformSoundsHandle} exposed via `ref` for imperative
 *     control (`play`, `setFilter`, `setSort`, …).
 *
 * @see {@link https://github.com/arraypress/waveform-sounds} — core library
 */
import type { CSSProperties } from 'react';
import type {
	WaveformSounds,
	WaveformSoundsOptions,
	Sound,
	SoundsFilter,
	SoundsSort,
} from '@arraypress/waveform-sounds';

/**
 * Core types re-exported from `@arraypress/waveform-sounds` — the
 * single-source-of-truth definitions shipped by the core, not local copies.
 */
export type {
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
	SoundsColumn,
} from '@arraypress/waveform-sounds';

/**
 * Imperative handle exposed through `ref`. Every method is a thin
 * pass-through to the live {@link WaveformSounds} instance; refer to the
 * core's docs for exact behaviour. Calls before the instance has mounted
 * (the runtime loads asynchronously on the client) are no-ops.
 */
export interface WaveformSoundsHandle {
	/**
	 * Play a sound — by index (in the original `sounds` order), by `id`, or
	 * by `Sound` object — or resume the current one. `opts.at` starts at a
	 * position 0..1.
	 */
	play(target?: number | string | Sound, opts?: { at?: number }): void;
	/** Pause the current sound. */
	pause(): void;
	/** The current sound plays / pauses; another sound starts. */
	toggle(target?: number | string | Sound): void;
	/** Play the next visible sound (no wrap at the end). */
	next(): void;
	/** Play the previous visible sound. */
	previous(): void;
	/** Merge a patch into the current filter and re-apply it. */
	setFilter(patch: Partial<SoundsFilter>): void;
	/** Reset every filter (the sort stays). */
	clearFilters(): void;
	/** Change the sort order. */
	setSort(by: SoundsSort): void;
	/**
	 * Turn looping on / off for the live instance — without a re-mount
	 * (changing the `loop` PROP re-creates the instance, like every other
	 * option; this is the way to flip it mid-playback).
	 */
	setLoop(on: boolean): void;
	/** Reveal the next page of results. */
	showMore(): void;
	/**
	 * Underlying `WaveformSounds` instance, or `null` before it mounts.
	 * Escape hatch for anything the methods above don't cover (`visible`,
	 * `current`, `sounds`, `engine`, `ready`, …).
	 */
	readonly instance: WaveformSounds | null;
}

/**
 * Props accepted by `<WaveformSounds>`.
 *
 * Two groups:
 *
 *   1. **Every core option** — inherited from {@link WaveformSoundsOptions}
 *      unchanged: the data (`sounds`, or `manifest`), the layout
 *      (`player`, `columns`, `pageSize`, …), the toolbar (`search`,
 *      `filters`, `sorts`, `showCount`, `menuSearch`, `loopToggle`,
 *      `maxTypeChips`), the row
 *      waveform (`waveformStyle`, colours, `barWidth`, `barGap`),
 *      behaviour (`loop`, `autoAdvance`, `arrowAudition`), the engine
 *      (`playerOptions`, `playerClass`), `strings`, and the callbacks
 *      `onReady` / `onPlay` / `onPause` / `onEnd` / `onFilter` / `onError`.
 *      A changed value option re-creates the instance; a changed callback
 *      never does (the latest handler is always the one called).
 *   2. **React extras** — the DOM pass-throughs `id`, `className`, `style`.
 *
 * Because the option surface is inherited rather than hand-copied,
 * anything the core adds is typed here without a manual edit — but it
 * still has to be added to the runtime allowlist (the drift test fails
 * until it is).
 */
export interface WaveformSoundsProps extends WaveformSoundsOptions {
	/**
	 * DOM id forwarded to the host `<div>`. Useful for targeting the list
	 * from external scripts (`WaveformSounds.getInstance('#id')`).
	 */
	id?: string;
	/**
	 * Extra class names on the host. `wfp-host`, `waveform-sounds` and
	 * `waveform-sounds--<player>` are always applied.
	 */
	className?: string;
	/**
	 * Inline style for the host — e.g. the `--ws-*` theming custom
	 * properties. The list is colour-agnostic by default; for server
	 * rendering set `--ws-surface` (the page background) so the first paint
	 * is right before the runtime detects it: `{ '--ws-surface': '#0a0a0a' }`.
	 */
	style?: CSSProperties;
}
