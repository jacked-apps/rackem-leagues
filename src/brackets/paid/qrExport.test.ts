/**
 * @fileoverview Tests for the QR export helpers — filenames and SVG serialization.
 *
 * The rasterizing half (downloadQrPng) needs a real canvas + image decoder, so
 * it is exercised by hand rather than mocked into meaninglessness here.
 */

import { describe, it, expect } from 'vitest';
import { qrFileName, svgToString } from './qrExport';

describe('qrFileName', () => {
  it('slugifies a tournament name', () => {
    expect(qrFileName('Friday 9-Ball', 'png')).toBe('friday-9-ball-join-qr.png');
  });

  it('strips punctuation rather than putting it in a filename', () => {
    expect(qrFileName("Tuesday's $20 8-Ball!", 'svg')).toBe(
      'tuesday-s-20-8-ball-join-qr.svg'
    );
  });

  it('still produces a filename for a name with nothing usable in it', () => {
    expect(qrFileName('!!!', 'png')).toBe('tournament-join-qr.png');
    expect(qrFileName('', 'svg')).toBe('tournament-join-qr.svg');
  });
});

describe('svgToString', () => {
  it('adds the namespace a standalone .svg file needs to open', () => {
    // Inline SVG in HTML works without xmlns; a saved file is parsed as XML and
    // will not open without it.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 10 10');

    const out = svgToString(svg);
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain('viewBox="0 0 10 10"');
  });

  it('does not mutate the element still being displayed on the page', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgToString(svg);
    // The clone got the attribute, not the live node.
    expect(svg.getAttribute('xmlns')).toBeNull();
  });
});
