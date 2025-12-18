import { NavLink, Link, useLocation } from 'react-router-dom';
import { useUserProfile, useMemberId, useUnreadMessageCount } from '@/api/hooks';
import { useOrganizations } from '@/api/hooks/useOrganizations';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

export const NavBar: React.FC = () => {
  const { member, hasMemberRecord, canAccessLeagueOperatorFeatures } = useUserProfile();
  const memberId = useMemberId();
  const { data: unreadCount = 0 } = useUnreadMessageCount(memberId);
  const location = useLocation();

  // Get user's organizations for operator dashboard link
  const { organizations } = useOrganizations(member?.id);
  const primaryOrg = organizations[0];

  // Hide navbar on mobile when on Messages page
  const isMessagesPage = location.pathname === '/messages';
  const hideOnMobile = isMessagesPage;

  return (
    <nav className={`flex w-full py-2 border-b border-slate-300 px-6 justify-between items-center ${hideOnMobile ? 'hidden md:flex' : 'flex'}`}>
      {/* Left side - main navigation */}
      <ul className="flex gap-5 list-none m-0 p-0">
        <li>
          <NavLink
            to="/"
            className={({ isActive }) =>
              `text-blue-600 hover:underline ${isActive ? 'font-semibold' : ''}`
            }
          >
            Home
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `text-blue-600 hover:underline ${isActive ? 'font-semibold' : ''}`
            }
          >
            About
          </NavLink>
        </li>
        {hasMemberRecord() && (
          <li>
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `text-blue-600 hover:underline ${isActive ? 'font-semibold' : ''}`
              }
            >
              Profile
            </NavLink>
          </li>
        )}
      </ul>

      {/* Right side - messages and operator access */}
      <div className="flex items-center gap-3">
        {hasMemberRecord() && (
          <Link to="/messages" className="relative">
            <Button variant="ghost" size="sm" className="relative">
              <Mail className="h-6 w-6" />
              {/* Unread badge - shows real count, hidden when 0 */}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
          </Link>
        )}

        {canAccessLeagueOperatorFeatures() && primaryOrg && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/operator-dashboard/${primaryOrg.id}`}>
              🎱 League Admin
            </Link>
          </Button>
        )}
      </div>
    </nav>
  );
};
