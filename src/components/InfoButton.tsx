/**
 * @fileoverview InfoButton Component
 * Reusable info button that shows helpful explanations in a floating popup
 */
import React, { useState, useRef, useEffect } from 'react';

interface InfoButtonProps {
  title: string;
  children: React.ReactNode;
  label?: string;
  className?: string;
  /** Size variant: 'sm' for smaller inline use, 'default' for standard size */
  size?: 'sm' | 'default';
  /** Force popup alignment: 'left', 'right', or 'center'. If not set, auto-detects based on viewport. */
  align?: 'left' | 'right' | 'center';
}

/**
 * InfoButton Component
 *
 * Shows a small question mark button that toggles a floating popup
 *
 * @param title - Title for the info popup
 * @param children - Content to display in the info popup (can be JSX)
 * @param label - Optional text to display before the ? button
 * @param className - Additional CSS classes for the container
 * @param size - Size variant: 'sm' (16px) or 'default' (24px)
 * @param align - Force popup alignment: 'left', 'right', or 'center'. Auto-detects if not set.
 */
/** Calculate fixed position for the popup based on button location and alignment */
function getPopupStyle(
  button: HTMLButtonElement | null,
  position: 'left' | 'right' | 'center',
): React.CSSProperties {
  if (!button) return {};
  const rect = button.getBoundingClientRect();
  const popupWidth = 320;
  const topOffset = rect.bottom + 4; // 4px gap below button

  if (position === 'left') {
    return { top: topOffset, left: Math.max(8, rect.left) };
  }
  if (position === 'right') {
    return { top: topOffset, right: Math.max(8, window.innerWidth - rect.right) };
  }
  // Center
  const centerLeft = rect.left + rect.width / 2 - popupWidth / 2;
  return { top: topOffset, left: Math.max(8, Math.min(centerLeft, window.innerWidth - popupWidth - 8)) };
}

export const InfoButton: React.FC<InfoButtonProps> = ({
  title,
  children,
  label,
  className = "",
  size = 'default',
  align,
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const [popupPosition, setPopupPosition] = useState<'left' | 'right' | 'center'>('center');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Calculate popup position to keep it on screen (unless align prop is set)
  useEffect(() => {
    if (align) {
      // Use forced alignment
      setPopupPosition(align);
    } else if (showInfo && buttonRef.current) {
      // Auto-detect based on viewport
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const popupWidth = 320; // w-80 = 320px
      const buttonCenter = buttonRect.left + buttonRect.width / 2;

      // Check if centering the popup would go off screen
      const popupLeft = buttonCenter - popupWidth / 2;
      const popupRight = buttonCenter + popupWidth / 2;

      if (popupLeft < 0) {
        // Too far left, align to left edge
        setPopupPosition('left');
      } else if (popupRight > viewportWidth) {
        // Too far right, align to right edge
        setPopupPosition('right');
      } else {
        // Fits centered
        setPopupPosition('center');
      }
    }
  }, [showInfo, align]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showInfo &&
        popupRef.current &&
        buttonRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowInfo(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInfo]);

  const togglePopup = () => {
    setShowInfo(!showInfo);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-1">
        {label && (
          <span className="text-gray-700 text-sm font-medium">
            {label}
          </span>
        )}
        <button
          ref={buttonRef}
          onClick={togglePopup}
          className={`rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center font-bold ${
            size === 'sm' ? 'w-4 h-4 text-xs' : 'w-6 h-6 text-sm'
          }`}
          title="More information"
        >
          ?
        </button>
      </div>

      {showInfo && (
        <div
          ref={popupRef}
          className="fixed z-50 w-80 p-4 bg-white border border-gray-200 rounded-lg shadow-lg"
          style={getPopupStyle(buttonRef.current, popupPosition)}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <button
              onClick={togglePopup}
              className="w-5 h-5 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <div className="text-gray-700 text-sm">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};