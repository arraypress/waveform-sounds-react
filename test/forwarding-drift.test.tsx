/**
 * test/forwarding-drift.test.tsx
 * ------------------------------
 *
 * Forwarding-drift guard. The props type inherits every option from the
 * core, but the runtime forward list (`buildSoundsOptions` + the remount
 * deps) is hand-written — so an option the core adds typechecks here and
 * is silently dropped unless someone wires it. That is exactly how
 * `crossOrigin` went missing from all four playlist wrappers for two weeks.
 *
 * Every key of `WaveformSoundsOptions` (read from the installed core's
 * `index.d.ts`, see `option-surface.ts`) must either be forwarded — and
 * re-mount the list when it changes — or be listed in `NOT_FORWARDED` with
 * the reason. Adding an option to the core without deciding which fails
 * this file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { WaveformSounds } from '../src/WaveformSounds';
import type { WaveformSoundsProps } from '../src/types';
import { ALL_OPTIONS, isCallback } from './option-surface';

/**
 * Options deliberately NOT forwarded to the constructor. Empty today: every
 * core option is a prop and reaches the runtime. Keep the map (and its
 * stale-entry check) so excluding one later is a reviewed decision.
 */
const NOT_FORWARDED: Record<string, string> = {};

const FORWARDED = ALL_OPTIONS.filter((key) => !(key in NOT_FORWARDED));
const VALUES = FORWARDED.filter((key) => !isCallback(key));
const CALLBACKS = FORWARDED.filter(isCallback);

/**
 * A sample value per option. Most get a marker string; `sounds` must be a
 * real list because the wrapper server-renders it.
 */
const sample = (key: string, variant = ''): unknown =>
	key === 'sounds' ? [{ url: `/a${variant}.mp3` }] : `__${key}__${variant}`;

const ctorCalls: Array<Record<string, unknown>> = [];

vi.mock('@arraypress/waveform-sounds/no-autoinit', () => {
	const Ctor = vi.fn(function (this: { destroy: () => void }, el: HTMLElement, opts: Record<string, unknown>) {
		ctorCalls.push(opts);
		this.destroy = () => {};
		// A DOM mutation wakes testing-library's waitFor immediately.
		el.setAttribute('data-mounts', String(ctorCalls.length));
	});
	return { default: Ctor, WaveformSounds: Ctor };
});

beforeEach(() => {
	cleanup();
	ctorCalls.length = 0;
});

/** Render with arbitrary (untyped) option props. */
const el = (extra: Record<string, unknown>) => (
	<WaveformSounds {...(extra as Partial<WaveformSoundsProps>)} />
);

describe('forwarding drift', () => {
	it('reads a plausible option surface from the core', () => {
		expect(ALL_OPTIONS.length).toBeGreaterThan(20);
		expect(ALL_OPTIONS).toContain('sounds');
		expect(ALL_OPTIONS).toContain('playerOptions');
		expect(ALL_OPTIONS).toContain('onFilter');
		// Nested members (`SoundsFilter`, callback params) must not leak in.
		expect(ALL_OPTIONS).not.toContain('instance');
		expect(ALL_OPTIONS).not.toContain('query');
	});

	it('NOT_FORWARDED lists only real options (no stale entries)', () => {
		expect(Object.keys(NOT_FORWARDED).filter((key) => !ALL_OPTIONS.includes(key))).toEqual([]);
	});

	it('forwards every other option into the constructor options', async () => {
		const props = Object.fromEntries(VALUES.map((key) => [key, sample(key)]));
		render(el(props));
		await waitFor(() => expect(ctorCalls).toHaveLength(1));

		const dropped = VALUES.filter((key) => {
			try {
				expect(ctorCalls[0][key]).toEqual(sample(key));
				return false;
			} catch {
				return true;
			}
		});
		expect(dropped, 'options neither forwarded nor in NOT_FORWARDED').toEqual([]);
	});

	it('re-mounts when any forwarded option changes', { timeout: 30_000 }, async () => {
		const props: Record<string, unknown> = Object.fromEntries(VALUES.map((key) => [key, sample(key)]));
		const { rerender } = render(el(props));
		await waitFor(() => expect(ctorCalls).toHaveLength(1));

		const stale: string[] = [];
		for (const key of VALUES) {
			const before = ctorCalls.length;
			props[key] = sample(key, 'changed');
			rerender(el({ ...props }));
			try {
				await waitFor(() => expect(ctorCalls.length).toBeGreaterThan(before), { timeout: 250 });
			} catch {
				stale.push(key);
			}
		}
		expect(stale, 'forwarded options missing from the remount deps').toEqual([]);
	});

	it('forwards every callback option, reaching the prop handler', async () => {
		const handlers = Object.fromEntries(CALLBACKS.map((key) => [key, vi.fn()]));
		render(el(handlers));
		await waitFor(() => expect(ctorCalls).toHaveLength(1));

		const dropped = CALLBACKS.filter((key) => {
			const fn = ctorCalls[0][key];
			if (typeof fn !== 'function') return true;
			fn('x');
			return !handlers[key].mock.calls.length;
		});
		expect(dropped, 'callbacks neither forwarded nor in NOT_FORWARDED').toEqual([]);
	});
});
