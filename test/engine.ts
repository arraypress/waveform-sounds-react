/**
 * test/engine.ts
 * --------------
 *
 * A stand-in for the ONE `WaveformPlayer` the sounds core uses as its audio
 * engine, passed as `playerClass`. The real player needs Web Audio / Canvas
 * jsdom lacks. This records the calls the core makes and drives the option
 * callbacks it wires up (onLoad / onPlay / onPause / onEnd), so the core's
 * own `onPlay` / `onPause` / `onEnd` — and through them the wrapper's
 * callback props — fire as they would in a browser.
 */
export class FakeEngine {
	static instances: FakeEngine[] = [];

	container: HTMLElement;
	options: Record<string, unknown>;
	audio = { src: '', duration: 10, loop: false };
	loaded: string[] = [];
	destroyed = false;

	constructor(container: HTMLElement, options: Record<string, unknown>) {
		this.container = container;
		this.options = options;
		FakeEngine.instances.push(this);
	}

	private call(name: string, ...args: unknown[]): void {
		const fn = this.options[name];
		if (typeof fn === 'function') fn(...args);
	}

	loadTrack(url: string, _title?: unknown, _artist?: unknown, opts: { autoplay?: boolean } = {}): void {
		this.loaded.push(url);
		this.audio.src = url;
		this.call('onLoad', this);
		if (opts.autoplay !== false) this.play();
	}

	play(): void {
		this.call('onPlay', this);
	}

	pause(): void {
		this.call('onPause', this);
	}

	seekTo(): void {}

	/** End the current sound, as the core player does. */
	end(): void {
		this.call('onEnd', this);
	}

	destroy(): void {
		this.destroyed = true;
	}
}
