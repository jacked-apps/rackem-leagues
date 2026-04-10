/**
 * @fileoverview DummyTextStep — temporary test step
 *
 * Plain text input step used to verify the WizardShell renders steps,
 * passes value/onChange correctly, and tracks form state. Will be deleted
 * once Phase 5 builds the real league wizard steps.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WizardStepProps } from '@/components/wizard';
import type { DummyFormData } from './dummyTypes';

export function DummyTextStep({ value, onChange }: WizardStepProps<string, DummyFormData>) {
  return (
    <div className="space-y-2">
      <Label htmlFor="dummy-text">Enter some text</Label>
      <Input
        id="dummy-text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type anything..."
      />
      <p className="text-xs text-gray-500">
        Current value: <code>{JSON.stringify(value)}</code>
      </p>
    </div>
  );
}
