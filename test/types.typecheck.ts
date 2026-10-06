/**
 * test/types.typecheck.ts
 * -----------------------
 *
 * Type-level assertions, checked by `npm run typecheck` (not vitest).
 *
 * Every option prop is the core's own type — derived from
 * `WaveformSoundsOptions`, never re-declared — and the handle's methods
 * take the core's argument types.
 */
import type { WaveformSoundsOptions } from '@arraypress/waveform-sounds';
import type { WaveformSoundsHandle, WaveformSoundsProps } from '../src/types';

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assert = <T extends true>(): T => true as T;

assert<Equal<Omit<WaveformSoundsProps, 'id' | 'className' | 'style'>, WaveformSoundsOptions>>();
assert<Equal<WaveformSoundsProps['player'], 'inline' | 'strip' | undefined>>();
assert<Equal<WaveformSoundsProps['columns'], ('type' | 'bpm' | 'key' | 'duration')[] | undefined>>();
assert<Equal<Parameters<WaveformSoundsHandle['setSort']>[0], 'default' | 'title' | 'bpm' | 'key' | 'duration'>>();

// @ts-expect-error — not a layout the core has
const bad: WaveformSoundsProps = { player: 'grid' };
void bad;
