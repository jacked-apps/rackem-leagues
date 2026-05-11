/**
 * @fileoverview Announcement Text Input Component
 *
 * Text area for composing announcement messages with character counter.
 * Enforces max length and shows remaining characters.
 */

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface AnnouncementTextInputProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

export function AnnouncementTextInput({
  value,
  onChange,
  maxLength = 500,
}: AnnouncementTextInputProps) {
  return (
    <div className="mt-6">
      <Label htmlFor="announcement" className="text-base font-semibold mb-3 block">
        Announcement Message
      </Label>
      <Textarea
        id="announcement"
        className="min-h-[120px]"
        placeholder="Enter your announcement message..."
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        maxLength={maxLength}
      />
      <p className="text-xs text-muted-foreground mt-1">
        {value.length}/{maxLength} characters
      </p>
    </div>
  );
}
