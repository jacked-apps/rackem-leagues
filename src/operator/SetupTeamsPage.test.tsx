/**
 * @fileoverview Tests for SetupTeamsPage — the season-setup chain's Teams step.
 * It shows "Save & Exit → league" + "Continue → Playoffs". The heavy content +
 * header are mocked to isolate the footer + navigation.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SetupTeamsPage } from './SetupTeamsPage';

vi.mock('@/components/PageHeader', () => ({
  PageHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/InfoButton', () => ({ InfoButton: () => null }));
vi.mock('./TeamManagementContent', () => ({
  TeamManagementContent: ({ renderFooter }: any) => (
    <div>{renderFooter?.({ leagueId: 'L1', seasonId: 'S1', hasTeams: true })}</div>
  ),
}));

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/league/L1/season/S1/setup-teams']}>
      <Routes>
        <Route path="/league/:leagueId/season/:seasonId/setup-teams" element={<SetupTeamsPage />} />
        <Route path="/league/:leagueId" element={<div>LEAGUE PAGE</div>} />
        <Route
          path="/league/:leagueId/season/:seasonId/playoffs-setup"
          element={<div>PLAYOFFS SETUP</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SetupTeamsPage (season-setup step)', () => {
  it('offers Save & Exit and Continue to Playoffs', () => {
    renderAt();
    expect(screen.getByRole('button', { name: /save & exit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue to playoffs/i })).toBeInTheDocument();
  });

  it('Continue advances to playoffs setup for this season', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /continue to playoffs/i }));
    expect(screen.getByText('PLAYOFFS SETUP')).toBeInTheDocument();
  });

  it('Save & Exit returns to the league page', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /save & exit/i }));
    expect(screen.getByText('LEAGUE PAGE')).toBeInTheDocument();
  });
});
