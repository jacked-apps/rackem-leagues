/**
 * @fileoverview Create Placeholder Player Modal
 *
 * Modal for creating placeholder players - real people who haven't registered yet.
 * Placeholder players can be added to teams and have games scored for them.
 * When the real person registers, they can be connected via invite link or operator merge.
 *
 * Required fields: First Name, Last Name, City, State
 * Nickname is optional - auto-generates from name if not provided.
 */

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { US_STATES } from '@/constants/states';
import { generateNickname } from '@/utils/nicknameGenerator';
import { createPlaceholderMember } from '@/api/mutations/members';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface CreatePlaceholderModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onOpenChange: (open: boolean) => void;
  /** Callback when placeholder is created successfully, returns the new member */
  onCreated?: (member: {
    id: string;
    first_name: string;
    last_name: string;
    system_player_number: number;
  }) => void;
  /** Optional default city to pre-fill */
  defaultCity?: string;
  /** Optional default state to pre-fill */
  defaultState?: string;
}

/**
 * Modal for creating placeholder players
 *
 * Shows a simple form with first name, last name, nickname (auto-generated),
 * city, and state. Creates a member record with user_id = NULL.
 */
export function CreatePlaceholderModal({
  open,
  onOpenChange,
  onCreated,
  defaultCity = '',
  defaultState = '',
}: CreatePlaceholderModalProps) {
  const queryClient = useQueryClient();

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState(defaultCity);
  const [state, setState] = useState(defaultState);
  const [handicap3v3, setHandicap3v3] = useState('0');
  const [handicap5v5, setHandicap5v5] = useState('40');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setFirstName('');
      setLastName('');
      setNickname('');
      setEmail('');
      setCity(defaultCity);
      setState(defaultState);
      setHandicap3v3('0');
      setHandicap5v5('40');
    }
  }, [open, defaultCity, defaultState]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createPlaceholderMember,
    onSuccess: (data) => {
      // Invalidate member queries so lists refresh
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['availableMembers'] });

      toast.success(`Created placeholder player: ${data.first_name} ${data.last_name}`);

      // Call onCreated callback with the new member
      if (onCreated) {
        onCreated(data);
      }

      onOpenChange(false);
    },
    onError: (error) => {
      logger.error('Failed to create placeholder member', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error('Failed to create placeholder player. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!lastName.trim()) {
      toast.error('Last name is required');
      return;
    }
    if (!city.trim()) {
      toast.error('City is required');
      return;
    }
    if (!state) {
      toast.error('State is required');
      return;
    }

    // Auto-generate nickname if not provided
    const finalNickname = nickname.trim() || generateNickname(firstName, lastName);

    createMutation.mutate({
      first_name: firstName,
      last_name: lastName,
      nickname: finalNickname,
      city,
      state,
      starting_handicap_3v3: parseInt(handicap3v3, 10) || 0,
      starting_handicap_5v5: parseInt(handicap5v5, 10) || 40,
      // Optional email - if provided, allows PP to be on multiple teams
      email: email.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Placeholder Player</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              Create a representation of a real person playing in your league who has not yet registered.
            </span>
            <span className="block text-xs text-muted-foreground">
              Without an email, this player can only be on a single team. Add their email to allow
              them to be on multiple teams and enable easier account linking when they register.
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* First Name */}
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
                placeholder="John"
                autoFocus
              />
            </div>

            {/* Last Name */}
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
                placeholder="Smith"
              />
            </div>

            {/* Nickname (optional - auto-generated if empty) */}
            <div className="grid gap-2">
              <Label htmlFor="nickname">
                Nickname
                <span className="ml-2 text-xs text-muted-foreground">
                  (optional, max 12 chars)
                </span>
              </Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNickname(e.target.value.slice(0, 12))}
                placeholder="Auto-generated if empty"
                maxLength={12}
              />
            </div>

            {/* Email (optional - for multi-team verification) */}
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email
                <span className="ml-2 text-xs text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder="player@example.com"
              />
              <p className="text-xs text-muted-foreground">
                Required if this player will be on multiple teams.
              </p>
            </div>

            {/* City */}
            <div className="grid gap-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={city}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
                placeholder="Austin"
              />
            </div>

            {/* State */}
            <div className="grid gap-2">
              <Label htmlFor="state">State *</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Starting Handicaps */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="handicap3v3">Points Handicap</Label>
                <Select value={handicap3v3} onValueChange={setHandicap3v3}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-2">-2</SelectItem>
                    <SelectItem value="-1">-1</SelectItem>
                    <SelectItem value="0">0</SelectItem>
                    <SelectItem value="1">+1</SelectItem>
                    <SelectItem value="2">+2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="handicap5v5">Percentage Handicap</Label>
                <Input
                  id="handicap5v5"
                  type="number"
                  min="0"
                  max="100"
                  value={handicap5v5}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHandicap5v5(e.target.value)}
                />
              </div>
            </div>

            {/* Important notice about PP management */}
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Important:</p>
              <p>
                Captains may not be able to remove placeholder players from teams.
                Contact your league operator if a placeholder player needs to be removed.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              isLoading={createMutation.isPending}
              loadingText="Creating..."
            >
              Create Player
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
