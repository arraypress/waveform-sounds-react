/**
 * test/WaveformSounds.test.tsx
 * ----------------------------
 *
 * Tests for the wrapper's own responsibilities, with the runtime entry
 * (`@arraypress/waveform-sounds/no-autoinit`) mocked at the module boundary
 * so every construct / destroy and the exact options handed over are
 * observable: server markup, the mount / unmount lifecycle, StrictMode,
 * option pass-through, re-mount on value changes (and NOT on DOM-only /
 * callback / equal-literal changes), callback trampolines, and the ref
 * handle. The renderer (`/render`) is the real one.
 *
 * `integration.test.tsx` repeats the important paths against the real core.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { renderSounds } from '@arraypress/waveform-sounds/render';
import { WaveformSounds } from '../src/WaveformSounds';
import type { SoundInput, WaveformSoundsHandle } from '../src/types';

const makeStub = () => ({
	destroy: vi.fn(),
	play: vi.fn(),
	pause: vi.fn(),
	toggle: vi.fn(),
	next: vi.fn(),
	previous: vi.fn(),
	setFilter: vi.fn(),
	clearFilters: vi.fn(),
	setSort: vi.fn(),
	setLoop: vi.fn(),
	showMore: vi.fn(),
});

const ctorCalls: Array<{
	el: HTMLElement;
	opts: Record<string, unknown>;
	stub: ReturnType<typeof makeStub> & { instance: unknown };
	/** `data-title` of each row the instance found at construction. */
	adoptedTitles: string[];
}> = [];

/** Construct / destroy events in order, to assert destroy → construct. */
const lifecycle: string[] = [];


vi.mock('@arraypress/waveform-sounds/no-autoinit', () => {
	const Ctor = vi.fn(function (this: Record<string, unknown>, el: HTMLElement, opts: Record<string, unknown>) {
		const stub = Object.assign(makeStub(), { instance: this });
		const n = ctorCalls.length;
		/* Model the runtime's DOM contract: adopt the rows, add only the
		 * classes the host lacks (destroy() takes back exactly those), mutate
		 * row state, and leave adopted rows as they are on destroy. */
		const rows = Array.from(el.querySelectorAll<HTMLElement>('[data-ws-index]'));
		const added = ['waveform-sounds', `waveform-sounds--${opts.player === 'strip' ? 'strip' : 'inline'}`].filter(
			(c) => !el.classList.contains(c)
		);
		el.classList.add(...added);
		rows.forEach((r) => r.classList.add(`touched-by-${n}`));
		stub.destroy.mockImplementation(() => {
			lifecycle.push(`destroy:${n}`);
			el.classList.remove(...added);
		});
		lifecycle.push(`construct:${n}`);
		ctorCalls.push({ el, opts, stub, adoptedTitles: rows.map((r) => r.dataset.title ?? '') });
		Object.assign(this, stub);
		// Like the core: built on a microtask after `new` returns.
		void Promise.resolve().then(() => (opts.onReady as ((i: unknown) => void) | undefined)?.(this));
	});
	return { default: Ctor, WaveformSounds: Ctor };
});

beforeEach(() => {
	cleanup();
	ctorCalls.length = 0;
	lifecycle.length = 0;
});

const SOUNDS: SoundInput[] = [
	{ url: '/s/bass-01.mp3', title: 'Bass Loop 01', type: 'Bass', bpm: 128, key: 'Fm', duration: 8 },
	{ url: '/s/drum-01.mp3', title: 'Drum Loop 01', type: 'Drums', bpm: 140, duration: 4 },
	{ url: '/s/crash.mp3', title: 'Crash', type: 'One-shots' },
];

/** Markup as the DOM serialises it (`hidden` → `hidden=""`, …). */
const normalized = (html: string): string => {
	const div = document.createElement('div');
	div.innerHTML = html;
	return div.innerHTML;
};

async function waitForMount(count = 1): Promise<void> {
	await waitFor(() => expect(ctorCalls.length).toBeGreaterThanOrEqual(count));
}

/** Let any pending import / effect run, then assert nothing else mounted. */
const tick = (ms = 50) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── Host + server markup ────────────────────────────────────────────────

describe('<WaveformSounds> — host and markup', () => {
	it('renders the core renderer\'s markup inside the host, before the runtime loads', () => {
		const { container } = render(<WaveformSounds sounds={SOUNDS} />);
		const host = container.firstElementChild as HTMLElement;
		// Synchronously — no effect / import has run yet.
		expect(host.querySelectorAll('[data-ws-index]')).toHaveLength(3);
		expect(host.querySelector('[data-ws-list]')).not.toBeNull();
		expect(host.querySelector('[data-ws-count]')!.textContent).toBe('3 sounds');
		expect(host.innerHTML).toBe(normalized(renderSounds(SOUNDS)));
	});

	it('renders with the same render options it forwards', () => {
		const opts = { player: 'strip', search: false, columns: ['bpm'], pageSize: 2 } as const;
		const { container } = render(<WaveformSounds sounds={SOUNDS} {...opts} columns={['bpm']} />);
		expect(container.firstElementChild!.innerHTML).toBe(normalized(renderSounds(SOUNDS, { ...opts, columns: ['bpm'] })));
	});

	it('applies the component classes (styled before hydration) plus className / id / style', () => {
		const { container } = render(
			<WaveformSounds sounds={SOUNDS} player="strip" id="pack" className="extra" style={{ maxWidth: 600 }} />
		);
		const host = container.firstElementChild as HTMLElement;
		expect(host.id).toBe('pack');
		expect(host).toHaveClass('wfp-host', 'waveform-sounds', 'waveform-sounds--strip', 'extra');
		expect(host.style.maxWidth).toBe('600px');
	});

	it('does not carry data-waveform-sounds (the global auto-init must not double-mount)', () => {
		const { container } = render(<WaveformSounds sounds={SOUNDS} />);
		expect(container.querySelector('[data-waveform-sounds]')).toBeNull();
	});

	it('renders an empty host for a manifest (the runtime fetches and builds it)', async () => {
		const { container } = render(<WaveformSounds manifest="/sounds.json" />);
		expect(container.firstElementChild!.innerHTML).toBe('');
		await waitForMount();
		expect(ctorCalls[0].opts.manifest).toBe('/sounds.json');
		expect('sounds' in ctorCalls[0].opts).toBe(false);
	});
});

// ─── Lifecycle ───────────────────────────────────────────────────────────

describe('<WaveformSounds> — lifecycle', () => {
	it('constructs once on the host, adopting the rendered rows', async () => {
		const { container } = render(<WaveformSounds sounds={SOUNDS} />);
		await waitForMount();
		expect(ctorCalls).toHaveLength(1);
		expect(ctorCalls[0].el).toBe(container.firstElementChild);
		expect(ctorCalls[0].adoptedTitles).toEqual(['Bass Loop 01', 'Drum Loop 01', 'Crash']);
	});

	it('constructs exactly once under StrictMode, and destroys it on unmount', async () => {
		const { unmount } = render(
			<StrictMode>
				<WaveformSounds sounds={SOUNDS} />
			</StrictMode>
		);
		await waitForMount();
		await tick();
		expect(ctorCalls).toHaveLength(1);
		expect(ctorCalls[0].stub.destroy).not.toHaveBeenCalled();

		unmount();
		expect(ctorCalls[0].stub.destroy).toHaveBeenCalledTimes(1);
	});

	it('never constructs when unmounted before the runtime loads', async () => {
		const { unmount } = render(<WaveformSounds sounds={SOUNDS} />);
		unmount();
		await tick();
		expect(ctorCalls).toHaveLength(0);
	});

	it('re-mounts when the sounds change: destroy, then construct on the NEW markup', async () => {
		const { rerender, container } = render(<WaveformSounds sounds={SOUNDS} />);
		await waitForMount();

		rerender(<WaveformSounds sounds={[{ url: '/s/new.mp3', title: 'New One' }]} />);
		await waitForMount(2);

		expect(lifecycle).toEqual(['construct:0', 'destroy:0', 'construct:1']);
		expect(ctorCalls[1].adoptedTitles).toEqual(['New One']);
		expect(ctorCalls[1].opts.sounds).toEqual([{ url: '/s/new.mp3', title: 'New One' }]);
		expect(container.querySelectorAll('[data-ws-index]')).toHaveLength(1);
		expect(container.querySelector('[data-ws-count]')!.textContent).toBe('1 sound');
	});

	it('hands a re-mount clean markup, not the old instance\'s mutated rows', async () => {
		// `loop` doesn't change the markup, so React leaves innerHTML alone;
		// the wrapper must still reset what the old instance touched.
		const { rerender, container } = render(<WaveformSounds sounds={SOUNDS} />);
		await waitForMount();
		expect(container.querySelector('.touched-by-0')).not.toBeNull();

		rerender(<WaveformSounds sounds={SOUNDS} loop />);
		await waitForMount(2);
		expect(container.querySelector('.touched-by-0')).toBeNull();
		expect(container.querySelector('.touched-by-1')).not.toBeNull();
	});

	it('keeps the layout class across a re-mount and follows a player change', async () => {
		const { rerender, container } = render(<WaveformSounds sounds={SOUNDS} />);
		await waitForMount();
		rerender(<WaveformSounds sounds={SOUNDS} player="strip" />);
		await waitForMount(2);
		const host = container.firstElementChild as HTMLElement;
		expect(host).toHaveClass('waveform-sounds--strip');
		expect(ctorCalls[1].opts.player).toBe('strip');
	});

	it('does not re-mount for an equal inline literal, className, style or id', async () => {
		const { rerender, container } = render(
			<WaveformSounds
				sounds={[...SOUNDS]}
				filters={['type']}
				columns={['bpm', 'key']}
				strings={{ count: '{count} geluiden' }}
				playerOptions={{ height: 40 }}
			/>
		);
		await waitForMount();
		const before = container.firstElementChild!.innerHTML;

		rerender(
			<WaveformSounds
				sounds={[...SOUNDS]}
				filters={['type']}
				columns={['bpm', 'key']}
				strings={{ count: '{count} geluiden' }}
				playerOptions={{ height: 40 }}
				className="later"
				style={{ color: 'red' }}
				id="later"
			/>
		);
		await tick();
		expect(ctorCalls).toHaveLength(1);
		// …and React did not rewrite the live rows.
		expect(container.firstElementChild!.innerHTML).toBe(before);
	});

	it('a className-only change keeps the runtime\'s own host classes', async () => {
		const { rerender, container } = render(<WaveformSounds sounds={SOUNDS} className="a" />);
		await waitForMount();
		const host = container.firstElementChild as HTMLElement;
		host.classList.add('runtime-owned');

		rerender(<WaveformSounds sounds={SOUNDS} className="b" />);
		expect(host).toHaveClass('runtime-owned', 'waveform-sounds', 'waveform-sounds--inline', 'b');
		expect(host).not.toHaveClass('a');
	});
});

// ─── Options ─────────────────────────────────────────────────────────────

describe('<WaveformSounds> — options', () => {
	it('forwards options as given and omits unset ones', async () => {
		render(
			<WaveformSounds
				sounds={SOUNDS}
				player="strip"
				filters={['type', 'bpm']}
				pageSize={0}
				waveformStyle="bars"
				barGap={0}
				loop={false}
				autoAdvance
			/>
		);
		await waitForMount();
		const { opts } = ctorCalls[0];
		expect(opts).toMatchObject({
			player: 'strip',
			filters: ['type', 'bpm'],
			pageSize: 0, // 0 is a real value ("show all"), not "unset"
			waveformStyle: 'bars',
			barGap: 0,
			loop: false,
			autoAdvance: true,
		});
		expect('search' in opts).toBe(false);
		expect('playerClass' in opts).toBe(false);
	});

	it('passes playerClass through untouched', async () => {
		class Engine {}
		render(<WaveformSounds sounds={SOUNDS} playerClass={Engine} />);
		await waitForMount();
		expect(ctorCalls[0].opts.playerClass).toBe(Engine);
	});

	it('trampolines playerOptions callbacks, reaching the latest one without a re-mount', async () => {
		const first = vi.fn();
		const second = vi.fn();
		const { rerender } = render(<WaveformSounds sounds={SOUNDS} playerOptions={{ height: 40, onTimeUpdate: first }} />);
		await waitForMount();

		rerender(<WaveformSounds sounds={SOUNDS} playerOptions={{ height: 40, onTimeUpdate: second }} />);
		await tick();
		expect(ctorCalls).toHaveLength(1);

		const engineOpts = ctorCalls[0].opts.playerOptions as Record<string, unknown>;
		expect(engineOpts.height).toBe(40);
		(engineOpts.onTimeUpdate as (...a: unknown[]) => void)(1, 10, 'player');
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledWith(1, 10, 'player');
	});

	it('re-mounts when a playerOptions value changes', async () => {
		const { rerender } = render(<WaveformSounds sounds={SOUNDS} playerOptions={{ height: 40 }} />);
		await waitForMount();
		rerender(<WaveformSounds sounds={SOUNDS} playerOptions={{ height: 48 }} />);
		await waitForMount(2);
		expect((ctorCalls[1].opts.playerOptions as Record<string, unknown>).height).toBe(48);
	});
});

// ─── Callbacks ───────────────────────────────────────────────────────────

describe('<WaveformSounds> — callbacks', () => {
	const NAMES = ['onReady', 'onPlay', 'onPause', 'onEnd', 'onFilter', 'onError'] as const;

	it('forwards every callback with the core\'s arguments', async () => {
		const handlers = Object.fromEntries(NAMES.map((n) => [n, vi.fn()]));
		render(<WaveformSounds sounds={SOUNDS} {...handlers} />);
		await waitForMount();
		for (const name of NAMES) {
			(ctorCalls[0].opts[name] as (...a: unknown[]) => void)('a', 'b');
			expect(handlers[name], name).toHaveBeenCalledWith('a', 'b');
		}
	});

	it('reaches the latest handler without re-mounting when a callback changes', async () => {
		const first = vi.fn();
		const second = vi.fn();
		const { rerender } = render(<WaveformSounds sounds={SOUNDS} onPlay={first} />);
		await waitForMount();
		rerender(<WaveformSounds sounds={SOUNDS} onPlay={second} />);
		await tick();
		expect(ctorCalls).toHaveLength(1);

		(ctorCalls[0].opts.onPlay as (...a: unknown[]) => void)('sound', 'instance');
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledWith('sound', 'instance');
	});

	it('is a no-op when no handler is supplied', async () => {
		render(<WaveformSounds sounds={SOUNDS} />);
		await waitForMount();
		expect(() => (ctorCalls[0].opts.onEnd as (...a: unknown[]) => void)('s', 'i')).not.toThrow();
	});

	it('the ref already works inside onReady', async () => {
		const ref = createRef<WaveformSoundsHandle>();
		const onReady = vi.fn(() => ref.current?.setSort('bpm'));
		render(<WaveformSounds ref={ref} sounds={SOUNDS} onReady={onReady} />);
		await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
		expect(ctorCalls[0].stub.setSort).toHaveBeenCalledWith('bpm');
	});
});

// ─── Ref handle ──────────────────────────────────────────────────────────

describe('<WaveformSounds> — ref handle', () => {
	it('exposes null before mount and no-ops its methods', () => {
		const ref = createRef<WaveformSoundsHandle>();
		render(<WaveformSounds ref={ref} sounds={SOUNDS} />);
		expect(ref.current).not.toBeNull();
		expect(ref.current!.instance).toBeNull();
		expect(() => {
			ref.current!.play(0);
			ref.current!.setFilter({ type: 'Bass' });
			ref.current!.showMore();
		}).not.toThrow();
	});

	it('passes every method through to the live instance', async () => {
		const ref = createRef<WaveformSoundsHandle>();
		render(<WaveformSounds ref={ref} sounds={SOUNDS} />);
		await waitForMount();
		const { stub } = ctorCalls[0];
		const h = ref.current!;

		h.play(1, { at: 0.5 });
		h.pause();
		h.toggle('sound-2');
		h.next();
		h.previous();
		h.setFilter({ query: 'bass' });
		h.clearFilters();
		h.setSort('title');
		h.setLoop(true);
		h.showMore();

		expect(stub.play).toHaveBeenCalledWith(1, { at: 0.5 });
		expect(stub.pause).toHaveBeenCalled();
		expect(stub.toggle).toHaveBeenCalledWith('sound-2');
		expect(stub.next).toHaveBeenCalled();
		expect(stub.previous).toHaveBeenCalled();
		expect(stub.setFilter).toHaveBeenCalledWith({ query: 'bass' });
		expect(stub.clearFilters).toHaveBeenCalled();
		expect(stub.setSort).toHaveBeenCalledWith('title');
		expect(stub.setLoop).toHaveBeenCalledWith(true);
		expect(stub.showMore).toHaveBeenCalled();
		expect(h.instance).toBe(stub.instance);
	});

	it('follows a re-mount to the new instance, and clears on unmount', async () => {
		const ref = createRef<WaveformSoundsHandle>();
		const { rerender, unmount } = render(<WaveformSounds ref={ref} sounds={SOUNDS} />);
		await waitForMount();
		rerender(<WaveformSounds ref={ref} sounds={SOUNDS} loop />);
		await waitForMount(2);
		expect(ref.current!.instance).toBe(ctorCalls[1].stub.instance);

		const handle = ref.current!;
		unmount();
		expect(handle.instance).toBeNull();
	});
});
