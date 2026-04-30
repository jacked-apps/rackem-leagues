/**
 * @fileoverview Alert Dialog Component
 *
 * Reusable alert/info dialog for displaying messages with only an OK button.
 * Similar to window.alert() but with better UX using shadcn components.
 */

import React from 'react';
import { Button } from '@/components/ui/button';

interface AlertDialogProps {
  /** Dialog title */
  title: string;
  /** Alert message */
  message: string;
  /** Text for the OK button (default: "OK") */
  okText?: string;
  /** Called when user clicks OK or clicks outside */
  onOk: () => void;
  /** Alert type affects styling (default: 'info') */
  type?: 'info' | 'success' | 'warning' | 'error';
}

/**
 * AlertDialog Component
 *
 * A modal dialog for displaying informational messages, success confirmations,
 * warnings, or errors. Only has an OK button (no cancel).
 *
 * @example
 * <AlertDialog
 *   title="Success"
 *   message="Action recorded successfully"
 *   type="success"
 *   onOk={() => setShowAlert(false)}
 * />
 */
export const AlertDialog: React.FC<AlertDialogProps> = ({
  title,
  message,
  okText = 'OK',
  onOk,
  type = 'info',
}) => {
  // Get styling based on type
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          titleColor: 'text-green-900',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
        };
      case 'warning':
        return {
          titleColor: 'text-yellow-900',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
        };
      case 'error':
        return {
          titleColor: 'text-red-900',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
        };
      default: // info
        return {
          titleColor: 'text-blue-900',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onOk}
    >
      <div
        className="bg-card rounded-xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with colored background */}
        <div className={`${styles.bgColor} ${styles.borderColor} border-b px-6 py-4 rounded-t-xl`}>
          <h3 className={`text-lg font-bold ${styles.titleColor}`}>{title}</h3>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-foreground">{message}</p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end">
          <Button onClick={onOk} loadingText="none">
            {okText}
          </Button>
        </div>
      </div>
    </div>
  );
};
