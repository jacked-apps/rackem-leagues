/**
 * @fileoverview Group Name Input Component
 *
 * Input field for naming group conversations.
 * Shows suggested name based on selected members.
 * Only displayed when 2+ users selected.
 */

import React from 'react';
import { Input } from '@/components/ui/input';

interface GroupNameInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestedName: string;
}

export function GroupNameInput({ value, onChange, suggestedName }: GroupNameInputProps) {
  return (
    <div className="pb-4">
      <Input
        type="text"
        placeholder={`Group name (e.g., "${suggestedName}")`}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="bg-card"
      />
    </div>
  );
}
