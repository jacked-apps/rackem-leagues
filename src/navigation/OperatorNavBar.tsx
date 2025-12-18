/**
 * @fileoverview OperatorNavBar Component
 * Navigation bar specifically for league operators when they're in operator mode
 * Shows operator-specific navigation with option to return to player dashboard
 */
import { NavLink, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePendingReportsCount } from '@/hooks/usePendingReportsCount';

interface OperatorNavBarProps {
  /** Organization ID for navigation links */
  orgId: string;
}

/**
 * OperatorNavBar Component
 *
 * Navigation for league operators that provides:
 * - Left side: Operator-specific navigation links
 * - Right side: "Back to Player Dashboard" button
 *
 * This allows operators to switch between their operator and player views
 */
export const OperatorNavBar: React.FC<OperatorNavBarProps> = ({ orgId }) => {
  const { count: pendingReportsCount } = usePendingReportsCount(orgId);
  return (
    <nav className="flex w-full py-2 border-b border-slate-300 px-6 justify-between items-center bg-blue-50">
      {/* Left side - operator navigation */}
      <ul className="flex gap-5 list-none m-0 p-0">
        <li>
          <NavLink
            to={`/operator-dashboard/${orgId}`}
            className={({ isActive }) =>
              `text-blue-600 hover:underline ${isActive ? 'font-semibold' : ''}`
            }
          >
            🏠 Operator Dashboard
          </NavLink>
        </li>
        <li>
          <NavLink
            to={`/create-league/${orgId}`}
            className={({ isActive }) =>
              `text-blue-600 hover:underline ${isActive ? 'font-semibold' : ''}`
            }
          >
            ➕ Create League
          </NavLink>
        </li>
        <li>
          <NavLink
            to={`/operator-reports/${orgId}`}
            className={({ isActive }) =>
              `text-blue-600 hover:underline ${isActive ? 'font-semibold' : ''} flex items-center gap-2`
            }
          >
            🚩 Reports
            {pendingReportsCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {pendingReportsCount}
              </Badge>
            )}
          </NavLink>
        </li>
        {/* Future operator navigation items will go here */}
        {/*
        <li>
          <NavLink
            to="/manage-leagues"
            className={({ isActive }) =>
              `text-blue-600 hover:underline ${isActive ? 'font-semibold' : ''}`
            }
          >
            📊 Manage Leagues
          </NavLink>
        </li>
        */}
      </ul>

      {/* Right side - back to player dashboard */}
      <div className="flex items-center">
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">
            ← Back to Player Dashboard
          </Link>
        </Button>
      </div>
    </nav>
  );
};