/**
 * test/integration.test.tsx
 * -------------------------
 *
 * The wrapper against the REAL sounds core (`/no-autoinit`, nothing
 * mocked). The core builds and wires its rows fine in jsdom; only the
 * engine `WaveformPlayer` needs Web Audio, so a stand-in is passed as
 * `playerClass` (`test/engine.ts`).
 *
 * Covers what a mock can't prove: the runtime ADOPTS the server-rendered
 * rows React emitted (same nodes, not a rebuild); the callback props fire
 * from the core's own playback / filter paths alongside the bubbling
 * `waveformsounds:*` events; the ref drives the live instance; StrictMode
 * leaves exactly one instance; and a re-mount starts from clean markup.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { WaveformSounds as Core } from '@arraypress/waveform-sounds/no-autoinit';
import { WaveformSounds } from '../src/WaveformSounds';
import type { SoundInput, WaveformSoundsHandle, WaveformSoundsProps } from '../src/types';
import { FakeEngine } from './engine';

const SOUNDS: SoundInput[] = [
	{ url: '/s/bass-01.mp3', title: 'Bass Loop 01', type: 'Bass', bpm: 128, key: 'Fm', duration: 8, peaks: '204060' },
	{ url: '/s/drum-01.mp3', title: 'Drum Loop 01', type: 'Drums', bpm: 140, duration: 4 },
	{ url: '/s/bass-02.mp3', title: 'Bass Loop 02', type: 'Bass', bpm: 124, key: 'C', duration: 16 },
	{ url: '/s/crash.mp3', title: 'Crash', type: 'One-shots', id: 'crash' },
];

beforeEach(() => {
	FakeEngine.instances = [];
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/** Render, and resolve once the core reports ready. */
async function mount(props: Partial<WaveformSoundsProps> = {}) {
	const ref = createRef<WaveformSoundsHandle>();
	const onReady = vi.fn();
	const utils = render(
		<WaveformSounds ref={ref} sounds={SOUNDS} playerClass={FakeEngine} onReady={onReady} {...props} />
	);
	await waitFor(() => expect(onReady).toHaveBeenCalled());
	const host = utils.container.firstElementChild as HTMLElement;
	return { ...utils, ref, onReady, host };
}

const rows = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>('[data-ws-index]')];
const visibleTitles = (host: HTMLElement) => rows(host).filter((r) => !r.hidden).map((r) => r.dataset.title);

describe('integration — mount', () => {
	it('adopts the rows React rendered instead of rebuilding them', async () => {
		const ref = createRef<WaveformSoundsHandle>();
		const onReady = vi.fn();
		const { container } = render(
			<WaveformSounds ref={ref} sounds={SOUNDS} playerClass={FakeEngine} onReady={onReady} />
		);
		const host = container.firstElementChild as HTMLElement;
		const before = rows(host);

		await waitFor(() => expect(onReady).toHaveBeenCalled());
		expect(rows(host)).toEqual(before);
		rows(host).forEach((row, i) => expect(row).toBe(before[i]));
		expect(host.dataset.wsInitialized).toBe('true');
		expect(Core.getInstance(host)).toBe(ref.current!.instance);
		expect(onReady).toHaveBeenCalledWith(ref.current!.instance);
		expect(ref.current!.instance!.sounds.map((s) => s.title)).toEqual(SOUNDS.map((s) => s.title));
		expect(ref.current!.instance!.sounds[0].peaks).toHaveLength(3);
	});

	it('StrictMode leaves exactly one live instance, ready once', async () => {
		const onReady = vi.fn();
		const { container, unmount } = render(
			<StrictMode>
				<WaveformSounds sounds={SOUNDS} onReady={onReady} />
			</StrictMode>
		);
		await waitFor(() => expect(onReady).toHaveBeenCalled());
		await new Promise((r) => setTimeout(r, 50));
		expect(onReady).toHaveBeenCalledTimes(1);
		expect(Core.instances.size).toBe(1);
		expect(Core.getInstance(container.firstElementChild!)).not.toBeNull();

		unmount();
		expect(Core.instances.size).toBe(0);
	});

	it('builds the list from a manifest client-side', async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ version: 1, sounds: SOUNDS.slice(0, 2) }) }));
		vi.stubGlobal('fetch', fetchMock);
		const onReady = vi.fn();
		const { container } = render(<WaveformSounds manifest="/sounds.json" onReady={onReady} />);
		await waitFor(() => expect(onReady).toHaveBeenCalled());
		expect(fetchMock).toHaveBeenCalledWith('/sounds.json');
		expect(rows(container.firstElementChild as HTMLElement)).toHaveLength(2);
	});

	it('reports a failed manifest through onError', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const onError = vi.fn();
		render(<WaveformSounds manifest="/missing.json" onError={onError} />);
		await waitFor(() => expect(onError).toHaveBeenCalled());
		expect(String(onError.mock.calls[0][0])).toContain('HTTP 404');
	});

	it('builds the engine at ready (playerClass given), and reuses it to play', async () => {
		const { ref } = await mount();
		await ref.current!.instance!.ready;
		expect(FakeEngine.instances).toHaveLength(1);
		expect(FakeEngine.instances[0].loaded).toEqual([]);
		ref.current!.play(0);
		expect(FakeEngine.instances).toHaveLength(1);
		expect(FakeEngine.instances[0].loaded).toEqual(['/s/bass-01.mp3']);
	});

	it('destroys the instance and its engine on unmount', async () => {
		const { unmount, host, ref } = await mount();
		ref.current!.play(0);
		expect(FakeEngine.instances).toHaveLength(1);

		unmount();
		expect(Core.getInstance(host)).toBeNull();
		expect(FakeEngine.instances[0].destroyed).toBe(true);
	});
});

describe('integration — callbacks fire from the core', () => {
	it('onPlay / onPause / onEnd with (sound, instance), alongside the DOM events', async () => {
		const onPlay = vi.fn();
		const onPause = vi.fn();
		const onEnd = vi.fn();
		const events: string[] = [];
		const listen = (e: Event) => events.push(e.type);
		for (const t of ['play', 'pause', 'end']) document.addEventListener(`waveformsounds:${t}`, listen);

		const { host, ref } = await mount({ onPlay, onPause, onEnd });
		const instance = ref.current!.instance!;

		fireEvent.click(rows(host)[1].querySelector('.ws-play')!);
		expect(FakeEngine.instances[0].loaded).toEqual(['/s/drum-01.mp3']);
		expect(onPlay).toHaveBeenCalledWith(instance.sounds[1], instance);
		expect(rows(host)[1]).toHaveClass('is-playing');

		fireEvent.click(rows(host)[1].querySelector('.ws-play')!);
		expect(onPause).toHaveBeenCalledWith(instance.sounds[1], instance);

		// Resume, then let it end naturally (the engine fires pause → ended,
		// as a browser does): one pause, then one end — no second pause from
		// the core settling its state (play/pause fire only on a real state
		// change — core e4bd21f).
		fireEvent.click(rows(host)[1].querySelector('.ws-play')!);
		FakeEngine.instances[0].end();
		expect(onEnd).toHaveBeenCalledWith(instance.sounds[1], instance);
		expect(onEnd).toHaveBeenCalledTimes(1);
		expect(onPause).toHaveBeenCalledTimes(2);
		expect(rows(host)[1]).not.toHaveClass('is-playing');

		expect(events).toEqual([
			'waveformsounds:play',
			'waveformsounds:pause',
			'waveformsounds:play',
			'waveformsounds:pause',
			'waveformsounds:end',
		]);
		for (const t of ['play', 'pause', 'end']) document.removeEventListener(`waveformsounds:${t}`, listen);
	});

	it('onFilter with the matching sounds when the filter changes from the UI', async () => {
		const onFilter = vi.fn();
		const { host, ref } = await mount({ onFilter });
		onFilter.mockClear();

		fireEvent.click(host.querySelector('[data-ws-type="Bass"]')!);
		expect(onFilter).toHaveBeenCalledTimes(1);
		const [visible, inst] = onFilter.mock.calls[0];
		expect(visible.map((s: { title: string }) => s.title)).toEqual(['Bass Loop 01', 'Bass Loop 02']);
		expect(inst).toBe(ref.current!.instance);
	});

	it('a swapped handler is the one the core calls (no re-mount)', async () => {
		const first = vi.fn();
		const second = vi.fn();
		const { host, rerender, ref, onReady } = await mount({ onPlay: first });
		const instance = ref.current!.instance;

		rerender(<WaveformSounds ref={ref} sounds={SOUNDS} playerClass={FakeEngine} onReady={onReady} onPlay={second} />);
		fireEvent.click(rows(host)[0].querySelector('.ws-play')!);
		expect(ref.current!.instance).toBe(instance);
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});
});

describe('integration — ref handle drives the live instance', () => {
	it('setFilter / clearFilters / setSort / showMore', async () => {
		const { host, ref } = await mount({ pageSize: 2 });
		const h = ref.current!;
		expect(visibleTitles(host)).toEqual(['Bass Loop 01', 'Drum Loop 01']);

		h.showMore();
		expect(visibleTitles(host)).toHaveLength(4);

		h.setFilter({ type: 'Bass' });
		expect(visibleTitles(host)).toEqual(['Bass Loop 01', 'Bass Loop 02']);

		h.setSort('bpm');
		expect(visibleTitles(host)).toEqual(['Bass Loop 02', 'Bass Loop 01']);
		expect(host.querySelector('[data-ws-menu="sort"] [data-ws-menu-value]')!.textContent).toBe('BPM');

		h.clearFilters();
		expect(h.instance!.filter.type).toBe('');
		expect(h.instance!.sortBy).toBe('bpm');
		expect(visibleTitles(host)).toEqual(['Bass Loop 02', 'Bass Loop 01']); // page reset to 2
	});

	it('play / pause / toggle / next / previous / setLoop', async () => {
		const { host, ref } = await mount();
		const h = ref.current!;

		h.play('crash');
		const engine = FakeEngine.instances[0];
		expect(engine.loaded).toEqual(['/s/crash.mp3']);
		expect(h.instance!.current!.title).toBe('Crash');

		h.previous();
		expect(h.instance!.current!.title).toBe('Bass Loop 02');
		h.next();
		expect(h.instance!.current!.title).toBe('Crash');

		h.pause();
		expect(h.instance!.playing).toBe(false);
		h.toggle();
		expect(h.instance!.playing).toBe(true);

		h.setLoop(true);
		expect(engine.audio.loop).toBe(true);
		expect(host.querySelector('[data-ws-loop]')).toHaveAttribute('aria-pressed', 'true');
	});
});

describe('integration — sorts / showCount / menuSearch', () => {
	it('sorts sets the menu\'s orders and the starting order; showCount=false drops the count', async () => {
		const { host, ref } = await mount({ sorts: ['bpm', 'title'], showCount: false });
		const options = [...host.querySelectorAll('[data-ws-menu="sort"] [role=option]')].map((o) =>
			o.getAttribute('data-value')
		);
		expect(options).toEqual(['bpm', 'title']);
		expect(ref.current!.instance!.sortBy).toBe('bpm');
		expect(visibleTitles(host)).toEqual(['Bass Loop 02', 'Bass Loop 01', 'Drum Loop 01', 'Crash']);
		expect(host.querySelector('[data-ws-count]')).toBeNull();
	});

	it('sorts=[] removes the sort menu', async () => {
		const { host } = await mount({ sorts: [] });
		expect(host.querySelector('[data-ws-menu="sort"]')).toBeNull();
	});
});

describe('integration — urlState', () => {
	afterEach(() => window.history.replaceState(null, '', '/'));

	it('reads the filters from the address on load and keeps them in step', async () => {
		window.history.replaceState(null, '', '/?pack-type=Bass');
		const { host, ref } = await mount({ urlState: 'pack' });
		expect(visibleTitles(host)).toEqual(['Bass Loop 01', 'Bass Loop 02']);

		ref.current!.setFilter({ type: 'Drums' });
		// The core writes the address debounced (~250ms), with replaceState.
		await waitFor(() => expect(new URLSearchParams(window.location.search).get('pack-type')).toBe('Drums'));
	});

	it('leaves the address alone without it', async () => {
		window.history.replaceState(null, '', '/?type=Bass');
		const { host, ref } = await mount();
		expect(visibleTitles(host)).toHaveLength(4);
		ref.current!.setFilter({ type: 'Drums' });
		await new Promise((r) => setTimeout(r, 350));
		expect(window.location.search).toBe('?type=Bass');
	});
});

describe('integration — re-mount', () => {
	it('rebuilds on a sounds change, on the new rows', async () => {
		const { host, rerender, ref, onReady } = await mount();
		const first = ref.current!.instance;

		rerender(
			<WaveformSounds ref={ref} sounds={SOUNDS.slice(0, 2)} playerClass={FakeEngine} onReady={onReady} />
		);
		await waitFor(() => expect(onReady).toHaveBeenCalledTimes(2));
		expect(ref.current!.instance).not.toBe(first);
		expect(Core.instances.size).toBe(1);
		expect(rows(host)).toHaveLength(2);
		expect(host.querySelector('[data-ws-count]')!.textContent).toBe('2 sounds');
	});

	it('a re-mount that keeps the markup starts from clean rows and controls', async () => {
		const { host, rerender, ref, onReady } = await mount();
		// Leave the first instance in a used state: filtered, sorted, typed, playing.
		const search = host.querySelector<HTMLInputElement>('[data-ws-search]')!;
		search.value = 'bass';
		ref.current!.setFilter({ query: 'bass' });
		ref.current!.setSort('title');
		ref.current!.play(0);
		expect(visibleTitles(host)).toHaveLength(2);

		// `autoAdvance` doesn't change the markup — React leaves innerHTML alone.
		rerender(
			<WaveformSounds ref={ref} sounds={SOUNDS} playerClass={FakeEngine} onReady={onReady} autoAdvance />
		);
		await waitFor(() => expect(onReady).toHaveBeenCalledTimes(2));

		expect(visibleTitles(host)).toEqual(SOUNDS.map((s) => s.title));
		expect(host.querySelector<HTMLInputElement>('[data-ws-search]')!.value).toBe('');
		const sortMenu = host.querySelector('[data-ws-menu="sort"]')!;
		expect(sortMenu.querySelector('[data-ws-menu-value]')!.textContent).toBe('Default');
		expect(sortMenu.querySelector('[role=option][aria-selected="true"]')).toHaveAttribute('data-value', 'default');
		expect(host.querySelector('.is-playing, .is-current')).toBeNull();
		expect(ref.current!.instance!.options.autoAdvance).toBe(true);
	});

	it('follows a player change, with the matching layout class', async () => {
		const { host, rerender, ref, onReady } = await mount();
		rerender(
			<WaveformSounds ref={ref} sounds={SOUNDS} playerClass={FakeEngine} onReady={onReady} player="strip" />
		);
		await waitFor(() => expect(onReady).toHaveBeenCalledTimes(2));
		expect(host).toHaveClass('waveform-sounds', 'waveform-sounds--strip');
		expect(host).not.toHaveClass('waveform-sounds--inline');
		expect(host.querySelector('.ws-wave')).toBeNull();
	});
});
