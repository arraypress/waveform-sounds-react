// @vitest-environment node
/**
 * test/ssr.test.tsx
 * -----------------
 *
 * Server rendering, in a plain Node environment (no `window`, no
 * `document`): importing the wrapper must not touch the DOM, and
 * `renderToString` must emit the full list — toolbar, rows, count — so the
 * runtime has markup to adopt and the page is readable before any script.
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WaveformSounds } from '../src/WaveformSounds';

const SOUNDS = [
	{ url: '/s/bass-01.mp3', title: 'Bass Loop 01', type: 'Bass', bpm: 128, key: 'Fm' },
	{ url: '/s/drum-01.mp3', title: 'Drum <Loop> 01', type: 'Drums', bpm: 140 },
];

describe('server rendering', () => {
	it('runs with no DOM globals', () => {
		expect(typeof window).toBe('undefined');
		expect(typeof document).toBe('undefined');
	});

	it('emits the host with its classes and the rendered list', () => {
		const html = renderToString(<WaveformSounds sounds={SOUNDS} player="strip" className="mine" id="pack" />);
		expect(html).toMatch(/^<div id="pack" class="wfp-host waveform-sounds waveform-sounds--strip mine">/);
		expect(html).toContain('data-ws-list');
		expect(html.match(/data-ws-index=/g)).toHaveLength(2);
		expect(html).toContain('2 sounds');
		// Escaped by the core renderer, not double-escaped by React.
		expect(html).toContain('Drum &lt;Loop&gt; 01');
		expect(html).not.toContain('data-waveform-sounds');
	});

	it('emits an empty host for a manifest', () => {
		const html = renderToString(<WaveformSounds manifest="/sounds.json" />);
		expect(html).toBe('<div class="wfp-host waveform-sounds waveform-sounds--inline"></div>');
	});
});
