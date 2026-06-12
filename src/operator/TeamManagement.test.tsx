/**
 * @fileoverview Tests for the TeamManagement EDIT page wrapper — it shows a single
 * "Done → league" exit and NO playoffs/continue control (that lives on the
 * separate setup-teams page). The heavy content + header are mocked to isolate
 * the footer + navigation.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TeamManagement } from './TeamManagement';

vi.mock('@/components/PageHeader', () => ({
  PageHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/InfoButton', () => ({ InfoButton: () => null }));
vi.mock('./TeamManagementContent', () => ({
  TeamManagementContent: ({ renderFooter }: any) => (
    <div>{renderFooter?.({ leagueId: 'L1', seasonId: 'S1', hasTeams: true })}</div>
  ),
}));

function renderAt(path = '/league/L1/manage-teams') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/league/:leagueId/manage-teams" element={<TeamManagement />} />
        <Route path="/league/:leagueId" element={<div>LEAGUE PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TeamManagement (edit page)', () => {
  it('shows a single Done exit and no playoffs/continue control', () => {
    renderAt();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue|playoff/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save & exit/i })).not.toBeInTheDocument();
  });

  it('Done navigates back to the league page', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('LEAGUE PAGE')).toBeInTheDocument();
  });
});
