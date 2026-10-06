/**
 * WaveformSounds.tsx
 * ------------------
 *
 * React wrapper around `@arraypress/waveform-sounds`. Renders a host
 * `<div>` whose inner markup is the core's own server renderer output
 * (`renderSounds` from the DOM-free `@arraypress/waveform-sounds/render`),
 * then — on mount — constructs a `WaveformSounds` over that host. The
 * runtime ADOPTS the rendered rows instead of rebuilding them, so the list
 * is in the server HTML (readable, crawlable, no layout shift) and the
 * client only wires behaviour onto it. On unmount (or a value-prop change)
 * the instance is destroyed and rebuilt.
 *
 * ## Why server markup, not an empty div?
 *
 * The core's markup is the contract between its two halves: `renderSounds`
 * writes every class and `data-ws-*` attribute the runtime reads. Emitting
 * it from React (via `dangerouslySetInnerHTML`, which React treats as
 * opaque — it never reconciles the rows the runtime re-orders / hides)
 * gives SSR for free. With `manifest` and no `sounds` there is nothing to
 * render yet: the host is empty and the runtime fetches + builds the list.
 *
 * The host deliberately does **not** carry `data-waveform-sounds` — that
 * attribute drives the library's *global* auto-init, which would
 * double-mount on top of the instance this component creates. The runtime
 * is loaded from the core's `/no-autoinit` entry for the same reason.
 *
 * ## Re-mount on a value-prop change
 *
 * Like the family's other React wrappers, this re-creates the instance
 * when any construction-time option changes rather than diffing options
 * against the live instance. Arrays / objects (`sounds`, `filters`,
 * `columns`, `strings`, `playerOptions`) are compared by their serialised
 * value, so an inline literal does NOT re-mount on every parent render.
 * For live changes without a re-mount use the ref handle (`setLoop`,
 * `setFilter`, `setSort`, …).
 *
 * On a re-mount the wrapper restores the freshly rendered markup after
 * `destroy()` and before the next instance constructs: by design the core
 * leaves ADOPTED markup in place on destroy, still carrying the old
 * instance's state (row order, hidden rows, playing classes, control
 * values), and a new instance must not adopt that.
 *
 * ## Callbacks
 *
 * `onReady`, `onPlay`, `onPause`, `onEnd`, `onFilter` and `onError` are
 * the core's own option callbacks (it fires each alongside the matching
 * bubbling `waveformsounds:*` DOM event). They are handed over as stable
 * trampolines reading the latest prop, so they are NOT re-mount inputs.
 * Function values inside `playerOptions` (the engine player's callbacks)
 * get the same treatment.
 *
 * ## Library setup
 *
 * This component does **not** load CSS for you. Import both stylesheets
 * once at your app entry:
 *
 * ```ts
 * import '@arraypress/waveform-player/styles.css';
 * import '@arraypress/waveform-sounds/styles.css';
 * ```
 *
 * The list plays through ONE `WaveformPlayer`, constructed on first play
 * from `window.WaveformPlayer` — import the player core for that side
 * effect before anything plays, or pass the class as `playerClass`:
 *
 * ```ts
 * import '@arraypress/waveform-player'; // registers window.WaveformPlayer
 * ```
 *
 * The sounds runtime is imported dynamically inside `useEffect`, so it only
 * loads on the client (SSR / RSC safe); the renderer it shares with the
 * server never touches `window`.
 *
 * @module WaveformSounds
 */
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ForwardedRef,
} from 'react';
import { renderSounds } from '@arraypress/waveform-sounds/render';
// Aliased to avoid colliding with this file's own `WaveformSounds`
// component export. This is the core library's class type.
import type { WaveformSounds as WaveformSoundsInstance } from '@arraypress/waveform-sounds';
import type { WaveformSoundsHandle, WaveformSoundsProps } from './types';

/**
 * The core's option callbacks. Forwarded as stable trampolines that read
 * the latest prop at call time, so a new handler never re-mounts the list.
 */
const CALLBACK_PROPS = ['onReady', 'onPlay', 'onPause', 'onEnd', 'onFilter', 'onError'] as const;

type CallbackProp = (typeof CALLBACK_PROPS)[number];
type Callbacks = Pick<WaveformSoundsProps, CallbackProp>;
type AnyFn = (...args: unknown[]) => unknown;

type RuntimeModule = typeof import('@arraypress/waveform-sounds/no-autoinit');
let runtimePromise: Promise<RuntimeModule> | null = null;

/**
 * Load the browser runtime once per page and share the promise. Every
 * mount (and StrictMode's replayed effect) awaits the same import rather
 * than starting its own; a failed load is forgotten so the next mount
 * retries. (One shared promise also sidesteps a Vitest 4.1 mocker bug in
 * which the second of two CONCURRENT dynamic imports of a mocked module
 * gets the real module.)
 */
function loadRuntime(): Promise<RuntimeModule> {
	runtimePromise ??= import('@arraypress/waveform-sounds/no-autoinit').catch((err: unknown) => {
		runtimePromise = null;
		throw err;
	});
	return runtimePromise;
}

/**
 * A value's identity for the re-mount deps: its JSON, with every function
 * reduced to a marker (functions are forwarded through trampolines, so a
 * new function must not re-mount — only adding / removing one does).
 *
 * @param value - Any option value.
 * @returns A string that changes exactly when the value's data changes.
 */
function valueKey(value: unknown): string {
	if (value === undefined) return 'undefined';
	return JSON.stringify(value, (_key, v: unknown) => (typeof v === 'function' ? 'ƒ' : v)) ?? 'undefined';
}

/** True for a plain `{…}` object (not an array, not null). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Convert the component's props into the options object the
 * `WaveformSounds` constructor accepts. An EXPLICIT allowlist — the props
 * type inherits every core option, but only the keys listed here reach the
 * runtime (`test/forwarding-drift.test.tsx` fails when the core adds one
 * that isn't). Callbacks are added separately, as trampolines.
 *
 * @param props - The component's resolved props.
 * @returns An options object for `new WaveformSounds(el, …)`.
 */
function buildSoundsOptions(props: WaveformSoundsProps): Record<string, unknown> {
	const opts: Record<string, unknown> = {};

	/* Data. `sounds` is forwarded even when its markup is server-rendered
	 * (the runtime then adopts the rows and ignores it): if the host ever
	 * holds no list, the runtime builds one from it. */
	if (props.sounds !== undefined) opts.sounds = props.sounds;
	if (props.manifest !== undefined) opts.manifest = props.manifest;

	/* Layout + toolbar (these also shape the server-rendered markup) */
	if (props.player !== undefined) opts.player = props.player;
	if (props.search !== undefined) opts.search = props.search;
	if (props.filters !== undefined) opts.filters = props.filters;
	if (props.sortable !== undefined) opts.sortable = props.sortable;
	if (props.loopToggle !== undefined) opts.loopToggle = props.loopToggle;
	if (props.maxTypeChips !== undefined) opts.maxTypeChips = props.maxTypeChips;
	if (props.pageSize !== undefined) opts.pageSize = props.pageSize;
	if (props.columns !== undefined) opts.columns = props.columns;
	if (props.strings !== undefined) opts.strings = props.strings;

	/* Row waveform */
	if (props.waveformStyle !== undefined) opts.waveformStyle = props.waveformStyle;
	if (props.waveformColor !== undefined) opts.waveformColor = props.waveformColor;
	if (props.progressColor !== undefined) opts.progressColor = props.progressColor;
	if (props.barWidth !== undefined) opts.barWidth = props.barWidth;
	if (props.barGap !== undefined) opts.barGap = props.barGap;

	/* Behaviour */
	if (props.loop !== undefined) opts.loop = props.loop;
	if (props.autoAdvance !== undefined) opts.autoAdvance = props.autoAdvance;
	if (props.arrowAudition !== undefined) opts.arrowAudition = props.arrowAudition;

	/* The engine player. `playerOptions` function values are swapped for
	 * trampolines in the mount effect. */
	if (props.playerOptions !== undefined) opts.playerOptions = props.playerOptions;
	if (props.playerClass !== undefined) opts.playerClass = props.playerClass;

	return opts;
}

/**
 * Split a class string into its tokens (empty strings dropped).
 *
 * @param value - A space-separated class list.
 * @returns The individual class names.
 */
function classTokens(value: string): string[] {
	return value.split(/\s+/).filter(Boolean);
}

/**
 * Bring the host's wrapper-owned classes up to date without touching
 * anything else on the element: drop the tokens this component applied
 * last time that are no longer wanted, then add every wanted token
 * (`classList.add` is idempotent).
 *
 * @param el - The host element.
 * @param applied - Tokens this component applied on the previous sync.
 * @param wanted - Tokens it wants now.
 */
function syncHostClasses(el: HTMLElement, applied: readonly string[], wanted: readonly string[]): void {
	for (const token of applied) {
		if (!wanted.includes(token)) el.classList.remove(token);
	}
	if (wanted.length) el.classList.add(...wanted);
}

/**
 * `WaveformSounds` — React component wrapping `@arraypress/waveform-sounds`.
 *
 * Render where the sound list should appear. With `sounds`, the full list
 * (toolbar, rows, counts) is in the first render — server HTML included —
 * and becomes interactive once the runtime loads client-side.
 *
 * @example Basic
 *   <WaveformSounds
 *     sounds={[
 *       { url: '/s/bass-01.mp3', title: 'Bass Loop 01', type: 'Bass', bpm: 128, key: 'Fm' },
 *       { url: '/s/drum-01.mp3', title: 'Drum Loop 01', type: 'Drums', bpm: 140 },
 *     ]}
 *   />
 *
 * @example From a manifest, with a ref
 *   const ref = useRef<WaveformSoundsHandle>(null);
 *   <WaveformSounds ref={ref} manifest="/sounds.json" onPlay={(s) => console.log(s.title)} />
 *   <button onClick={() => ref.current?.setFilter({ type: 'Bass' })}>Bass only</button>
 */
export const WaveformSounds = forwardRef<WaveformSoundsHandle, WaveformSoundsProps>(
	function WaveformSounds(props, ref: ForwardedRef<WaveformSoundsHandle>) {
		const hostRef = useRef<HTMLDivElement | null>(null);
		const instanceRef = useRef<WaveformSoundsInstance | null>(null);

		/* Serialised identities for the array / object options, so an inline
		 * literal re-mounts only when its contents change. */
		const soundsKey = valueKey(props.sounds);
		const filtersKey = valueKey(props.filters);
		const columnsKey = valueKey(props.columns);
		const stringsKey = valueKey(props.strings);
		const playerOptionsKey = valueKey(props.playerOptions);
		const layout = props.player === 'strip' ? 'strip' : 'inline';

		/**
		 * The server-rendered inner markup — the same `renderSounds` the
		 * runtime would run, with the same render options, so what it adopts
		 * matches what it would have built. Empty without `sounds` (a
		 * `manifest` list is built client-side once fetched). Memoised on
		 * the render inputs, and the `{ __html }` object with it: React only
		 * rewrites `innerHTML` when that object changes, and a rewrite would
		 * wipe the runtime's live rows.
		 */
		const html = useMemo(
			() =>
				props.sounds
					? renderSounds(props.sounds, {
							player: props.player,
							search: props.search,
							filters: props.filters,
							sortable: props.sortable,
							loopToggle: props.loopToggle,
							maxTypeChips: props.maxTypeChips,
							pageSize: props.pageSize,
							columns: props.columns,
							strings: props.strings,
						})
					: '',
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[
				soundsKey,
				props.player,
				props.search,
				filtersKey,
				props.sortable,
				props.loopToggle,
				props.maxTypeChips,
				props.pageSize,
				columnsKey,
				stringsKey,
			]
		);
		const innerHtml = useMemo(() => ({ __html: html }), [html]);

		/* The latest markup, for the re-mount reset in the effect cleanup
		 * (which runs after this render's layout effects). */
		const htmlRef = useRef(html);
		useLayoutEffect(() => {
			htmlRef.current = html;
		}, [html]);

		/**
		 * Host `class` handling.
		 *
		 * The runtime may touch the host's class list (it adds
		 * `waveform-sounds` / `waveform-sounds--<player>` when they are
		 * missing, and `destroy()` takes back exactly what it added); other
		 * scripts may too. If React owned the `class` attribute, a
		 * `className`-only change (which rightly doesn't re-mount) would
		 * rewrite it under the live instance. So React renders the class
		 * ONCE: `renderedClass` is frozen at the first render (server markup
		 * and hydration still carry every class, so the list is styled before
		 * any script runs), and later changes are applied with `classList`,
		 * touching only the tokens this component put there — including the
		 * `waveform-sounds--<player>` swap when `player` changes. Same approach
		 * as waveform-playlist-react.
		 */
		const hostClass = ['wfp-host', 'waveform-sounds', `waveform-sounds--${layout}`, props.className]
			.filter(Boolean)
			.join(' ');
		const [renderedClass] = useState(hostClass);
		const appliedClassesRef = useRef<string[]>(classTokens(renderedClass));
		useLayoutEffect(() => {
			const el = hostRef.current;
			if (!el) return;
			const wanted = classTokens(hostClass);
			syncHostClasses(el, appliedClassesRef.current, wanted);
			appliedClassesRef.current = wanted;
		}, [hostClass]);

		/* Latest callback props (and `playerOptions`, whose function values
		 * are trampolined too). Read at call time, so swapping a handler takes
		 * effect without a re-mount. Refreshed before paint on every render. */
		const pickCallbacks = (): Callbacks =>
			Object.fromEntries(CALLBACK_PROPS.map((name) => [name, props[name]])) as Callbacks;
		const callbacksRef = useRef<Callbacks>(pickCallbacks());
		const playerOptionsRef = useRef(props.playerOptions);
		useLayoutEffect(() => {
			callbacksRef.current = pickCallbacks();
			playerOptionsRef.current = props.playerOptions;
		});

		/**
		 * Mount / re-mount lifecycle.
		 *
		 * The dep array holds EVERY value option the runtime reads at
		 * construction (arrays / objects by their serialised key). When any
		 * changes, the old instance is torn down and a new one built against
		 * the freshly-rendered markup.
		 *
		 * StrictMode's dev double-invoke (mount → cleanup → mount) never
		 * constructs twice: the runtime is imported asynchronously, and the
		 * first effect's cleanup cancels it before the import resolves.
		 */
		useEffect(() => {
			let cancelled = false;
			let localInstance: WaveformSoundsInstance | null = null;
			/* Read when the import resolves, not now: under React 19
			 * StrictMode the ref can still be detached while the replayed
			 * effect runs. Kept for the cleanup's markup reset. */
			let host: HTMLElement | null = null;

			/* Browser-only (observers, canvas, the engine player). Deferred
			 * until we're mounting client-side so SSR / RSC never evaluate it. */
			void loadRuntime()
				.then((mod) => {
					if (cancelled) return;
					host = hostRef.current;
					if (!host) return;

					const WaveformSoundsClass = (mod.default ??
						(mod as { WaveformSounds?: unknown }).WaveformSounds) as unknown;
					if (typeof WaveformSoundsClass !== 'function') {
						console.error('[WaveformSoundsReact] Failed to resolve WaveformSounds constructor from module.');
						return;
					}
					const Ctor = WaveformSoundsClass as new (
						el: HTMLElement,
						opts: Record<string, unknown>
					) => WaveformSoundsInstance;

					const opts = buildSoundsOptions(props);

					/* Engine callbacks inside playerOptions → trampolines. */
					if (isPlainObject(props.playerOptions)) {
						const engineOpts: Record<string, unknown> = { ...props.playerOptions };
						for (const [name, value] of Object.entries(engineOpts)) {
							if (typeof value !== 'function') continue;
							engineOpts[name] = (...args: unknown[]) => {
								const latest = playerOptionsRef.current as Record<string, unknown> | null | undefined;
								const fn = isPlainObject(latest) ? latest[name] : undefined;
								return typeof fn === 'function' ? (fn as AnyFn)(...args) : undefined;
							};
						}
						opts.playerOptions = engineOpts;
					}

					/* The core builds on a microtask after `new` returns, so every
					 * callback (onFilter / onReady included) fires after
					 * `instanceRef` below is set — a handler can use the ref. */
					for (const name of CALLBACK_PROPS) {
						opts[name] = (...args: unknown[]) =>
							(callbacksRef.current[name] as AnyFn | null | undefined)?.(...args);
					}

					try {
						localInstance = new Ctor(host as HTMLElement, opts);
						instanceRef.current = localInstance;
					} catch (err) {
						console.error('[WaveformSoundsReact] Failed to construct WaveformSounds:', err);
					}
				})
				.catch((err) => {
					console.error('[WaveformSoundsReact] Failed to load library:', err);
				});

			return () => {
				cancelled = true;
				const current = localInstance;
				if (!current) return;
				try {
					current.destroy();
				} catch (err) {
					console.warn('[WaveformSoundsReact] destroy() threw:', err);
				}
				if (instanceRef.current === current) instanceRef.current = null;
				/* Re-mount: hand the next instance clean markup. `destroy()`
				 * leaves adopted rows in place WITH the old state on them (sort
				 * order, hidden rows, playing classes, control values) — or, for
				 * a list it built itself, restores the host to what it held
				 * before, which may be stale markup. Unmount: host is detached,
				 * nothing to do. */
				if (host?.isConnected) host.innerHTML = htmlRef.current;
			};
			/* Re-mount on any construction-option change. Listed exhaustively
			 * (rather than spread) to make intent explicit; the serialised
			 * keys stand in for the array / object options. */
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [
			soundsKey,
			props.manifest,
			props.player,
			props.search,
			filtersKey,
			props.sortable,
			props.loopToggle,
			props.maxTypeChips,
			props.pageSize,
			columnsKey,
			stringsKey,
			props.waveformStyle,
			props.waveformColor,
			props.progressColor,
			props.barWidth,
			props.barGap,
			props.loop,
			props.autoAdvance,
			props.arrowAudition,
			playerOptionsKey,
			props.playerClass,
		]);

		/**
		 * Imperative handle on the forwarded ref. Each method is a thin
		 * pass-through to the live instance — calls before it has mounted
		 * (the runtime loads asynchronously) are no-ops.
		 */
		useImperativeHandle(
			ref,
			() => ({
				play(target, opts) {
					instanceRef.current?.play(target, opts);
				},
				pause() {
					instanceRef.current?.pause();
				},
				toggle(target) {
					instanceRef.current?.toggle(target);
				},
				next() {
					instanceRef.current?.next();
				},
				previous() {
					instanceRef.current?.previous();
				},
				setFilter(patch) {
					instanceRef.current?.setFilter(patch);
				},
				clearFilters() {
					instanceRef.current?.clearFilters();
				},
				setSort(by) {
					instanceRef.current?.setSort(by);
				},
				setLoop(on) {
					instanceRef.current?.setLoop(on);
				},
				showMore() {
					instanceRef.current?.showMore();
				},
				get instance() {
					return instanceRef.current;
				},
			}),
			[]
		);

		return (
			<div
				ref={hostRef}
				id={props.id}
				/* Frozen at first render — see "Host `class` handling". */
				className={renderedClass}
				style={props.style}
				dangerouslySetInnerHTML={innerHtml}
			/>
		);
	}
);
