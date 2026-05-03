/**
 * @fileoverview Conversation Search Bar Component
 *
 * Collapsible search input for filtering conversations.
 * Auto-focuses when shown.
 */

import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ConversationSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function ConversationSearchBar({ value, onChange }: ConversationSearchBarProps) {
  return (
    <div className="p-3 md:p-4 border-b bg-muted">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search conversations..."
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          className="pl-9 md:pl-10 h-10 md:h-11"
          autoFocus
        />
      </div>
    </div>
  );
}
