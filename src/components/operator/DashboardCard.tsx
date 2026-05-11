/**
 * @fileoverview DashboardCard Component
 * Reusable card component for operator dashboard quick actions
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DashboardCardProps {
  /** Icon element to display (lucide-react icon) */
  icon: React.ReactNode;
  /** Icon color class (e.g., 'text-blue-600') */
  iconColor: string;
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Button text */
  buttonText: string;
  /** Button link path (if link card) */
  linkTo?: string;
  /** Button click handler (if action card) */
  onClick?: () => void;
  /** Button variant */
  variant?: 'default' | 'outline';
  /** Button background color (for primary actions) */
  buttonColor?: string;
  /** Optional badge count to display */
  badgeCount?: number;
}

/**
 * DashboardCard Component
 *
 * Displays a quick action card on the operator dashboard with:
 * - Icon and title
 * - Description text
 * - Action button (either Link or onClick)
 * - Hover effect
 */
export const DashboardCard: React.FC<DashboardCardProps> = ({
  icon,
  iconColor,
  title,
  description,
  buttonText,
  linkTo,
  onClick,
  variant = 'outline',
  buttonColor,
  badgeCount,
}) => {
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleClick = () => {
    if (linkTo) {
      setIsNavigating(true);
      navigate(linkTo);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-2">
        <div className={iconColor}>{icon}</div>
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          {title}
          {badgeCount !== undefined && badgeCount > 0 && (
            <Badge variant="destructive">{badgeCount}</Badge>
          )}
        </h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      <Button
        variant={variant}
        className="w-full"
        onClick={handleClick}
        disabled={isNavigating}
        style={buttonColor ? { backgroundColor: buttonColor, color: 'white' } : undefined}
        loadingText="Loading..."
      >
        {isNavigating ? 'Loading...' : buttonText}
      </Button>
    </div>
  );
};
