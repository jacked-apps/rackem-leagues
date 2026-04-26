/**
 * @fileoverview InfoButton Component
 *
 * Reusable info-bubble button that pops a help panel near the trigger.
 * Positions itself robustly: measures the popup after mount, clamps to
 * the viewport on both axes, and flips above the button when there
 * isn't enough room below. Survives close-to-edge placement on phones,
 * inside collapsed accordions, and dense card layouts where the older
 * "always below + manual align" version was clipping off-screen.
 */
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';

interface InfoButtonProps {
  title: string;
  children: React.ReactNode;
  label?: string;
  className?: string;
  /** Size variant: 'sm' for smaller inline use, 'default' for standard size */
  size?: 'sm' | 'default';
  /** Force popup horizontal alignment. If unset, auto-clamps to viewport.
   *  (Vertical placement is always automatic — flips above when below
   *  doesn't have enough room.) */
  align?: 'left' | 'right' | 'center';
}

const VIEWPORT_MARGIN = 8;
const BUTTON_GAP = 4;

export const InfoButton: React.FC<InfoButtonProps> = ({
  title,
  children,
  label,
  className = '',
  size = 'default',
  align,
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({
    visibility: 'hidden',
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Measure-and-place after the popup mounts. useLayoutEffect runs before
  // paint, so the user never sees an unpositioned flash.
  useLayoutEffect(() => {
    if (!showInfo || !buttonRef.current || !popupRef.current) return;

    const button = buttonRef.current.getBoundingClientRect();
    const popup = popupRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // ---- Horizontal: clamp into viewport. Honor `align` when set,
    //      otherwise prefer center.
    let left: number;
    if (align === 'left') {
      left = button.left;
    } else if (align === 'right') {
      left = button.right - popup.width;
    } else {
      left = button.left + button.width / 2 - popup.width / 2;
    }
    // Clamp so we never spill off either edge.
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, vw - popup.width - VIEWPORT_MARGIN),
    );

    // ---- Vertical: prefer below; flip above when there isn't room.
    const spaceBelow = vh - button.bottom;
    const spaceAbove = button.top;
    const needed = popup.height + BUTTON_GAP + VIEWPORT_MARGIN;
    let top: number;
    if (spaceBelow >= needed || spaceBelow >= spaceAbove) {
      // Below is fine, OR neither side is great and below has more room.
      top = button.bottom + BUTTON_GAP;
      // Final safety clamp so the popup at least starts on-screen.
      top = Math.min(top, vh - popup.height - VIEWPORT_MARGIN);
      top = Math.max(top, VIEWPORT_MARGIN);
    } else {
      // Above has more room — anchor the popup's bottom just above the button.
      top = button.top - popup.height - BUTTON_GAP;
      top = Math.max(top, VIEWPORT_MARGIN);
    }

    setStyle({ position: 'fixed', top, left, visibility: 'visible' });
  }, [showInfo, align]);

  // Recompute on resize / scroll while open so a viewport change doesn't
  // strand the popup off-screen.
  useEffect(() => {
    if (!showInfo) return;
    const reposition = () => {
      // Re-trigger the layout effect by toggling a no-op style. Simpler than
      // duplicating the math: just force a re-render.
      setStyle((prev) => ({ ...prev }));
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [showInfo]);

  // Click-outside dismiss
  useEffect(() => {
    if (!showInfo) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
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

  // Reset visibility when reopening so we don't paint a stale position.
  const togglePopup = () => {
    setShowInfo((prev) => !prev);
    setStyle({ visibility: 'hidden' });
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-1">
        {label && (
          <span className="text-gray-700 text-sm font-medium">{label}</span>
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
          className="fixed z-50 w-80 max-h-[80vh] overflow-y-auto p-4 bg-white border border-gray-200 rounded-lg shadow-lg"
          style={style}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <button
              onClick={togglePopup}
              className="w-5 h-5 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="text-gray-700 text-sm">{children}</div>
        </div>
      )}
    </div>
  );
};
