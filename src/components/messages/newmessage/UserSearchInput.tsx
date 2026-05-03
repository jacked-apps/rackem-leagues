/**
 * @fileoverview User Search Input Component
 *
 * Search bar for filtering users by name or player number.
 * Includes icon and auto-focus for better UX.
 */

import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface UserSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function UserSearchInput({ value, onChange }: UserSearchInputProps) {
  return (
    <div className="p-6 border-b">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name or member number..."
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          className="pl-10"
          autoFocus
        />
      </div>
    </div>
  );
}
