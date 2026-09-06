/**
 * @fileoverview Tests for JoinQrPoster — the printable / big-screen join sign.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/utils';

const mocks = vi.hoisted(() => ({
  bracket: vi.fn(),
  print: vi.fn(),
  downloadSvg: vi.fn(),
  downloadPng: vi.fn(),
}));

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useParams: () => ({ bracketId: 'b1' }),
}));

vi.mock('@/api/hooks/useBrackets', () => ({ useBracket: () => mocks.bracket() }));

vi.mock('./qrExport', () => ({
  downloadQrSvg: (...args: unknown[]) => mocks.downloadSvg(...args),
  downloadQrPng: (...args: unknown[]) => mocks.downloadPng(...args),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { JoinQrPoster } from './JoinQrPoster';

function setup(over: Record<string, unknown> = {}) {
  mocks.bracket.mockReturnValue({
    data: {
      bracket: {
        id: 'b1',
        name: 'Friday 9-Ball',
        status: 'setup',
        join_token: 'jt-1',
        share_token: 'st-1',
        premium_features: ['real_players'],
        ...over,
      },
      participants: [],
      matches: [],
    },
    isLoading: false,
    isError: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.print = mocks.print;
  mocks.downloadPng.mockResolvedValue(undefined);
});

describe('JoinQrPoster', () => {
  it('names the tournament and shows the join URL in readable text', () => {
    setup();
    renderWithProviders(<JoinQrPoster />);

    expect(screen.getByText('Friday 9-Ball')).toBeTruthy();
    expect(screen.getByText(/\/brackets\/join\/jt-1$/)).toBeTruthy();
  });

  it('encodes the JOIN token, never the view-only share token', () => {
    setup();
    const { container } = renderWithProviders(<JoinQrPoster />);

    // A spectator holding the share link must not be able to add themselves.
    expect(container.querySelector('svg')).toBeTruthy();
    expect(screen.queryByText(/st-1/)).toBeNull();
  });

  it('prints on demand', () => {
    setup();
    renderWithProviders(<JoinQrPoster />);

    fireEvent.click(screen.getByRole('button', { name: /Print/ }));
    expect(mocks.print).toHaveBeenCalled();
  });

  it('offers no code for a tournament without player sign-up', () => {
    setup({ premium_features: ['payment_tracker'] });
    renderWithProviders(<JoinQrPoster />);

    expect(screen.getByText(/doesn't use player sign-up/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Print/ })).toBeNull();
  });

  it('handles a tournament with no join token rather than rendering a dead code', () => {
    setup({ join_token: null });
    renderWithProviders(<JoinQrPoster />);

    expect(screen.getByText(/no join code/i)).toBeTruthy();
  });

  it('saves the code as a vector file for a flyer, handing over the real <svg>', () => {
    setup();
    renderWithProviders(<JoinQrPoster />);

    fireEvent.click(screen.getByRole('button', { name: 'SVG' }));

    expect(mocks.downloadSvg).toHaveBeenCalled();
    // The ref must actually reach the rendered SVG, or nothing gets exported.
    const [node, name] = mocks.downloadSvg.mock.calls[0];
    expect(node).toBeInstanceOf(SVGSVGElement);
    expect(name).toBe('Friday 9-Ball');
  });

  it('saves a PNG for tools that will not take SVG', () => {
    setup();
    renderWithProviders(<JoinQrPoster />);

    fireEvent.click(screen.getByRole('button', { name: 'PNG' }));

    expect(mocks.downloadPng).toHaveBeenCalled();
    expect(mocks.downloadPng.mock.calls[0][0]).toBeInstanceOf(SVGSVGElement);
  });
});
