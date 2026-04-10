/**
 * @fileoverview DummyChoiceStep — temporary test step using CardSelector
 *
 * Verifies that CardSelector works inside the WizardShell. Includes a
 * disabled "Coming soon" option to test the toast behavior.
 *
 * Will be deleted once Phase 5 builds the real league wizard steps.
 */

import { CardSelector } from '@/components/wizard';
import type { WizardStepProps } from '@/components/wizard';
import type { DummyFormData } from './dummyTypes';

const OPTIONS = [
  { value: 'Option A', title: 'Option A', description: 'The first option' },
  { value: 'Option B', title: 'Option B', description: 'The second option' },
  { value: 'Option C', title: 'Option C', description: 'The third option' },
  {
    value: 'Option D',
    title: 'Option D',
    disabled: true,
    disabledMessage: 'Coming soon',
    description: 'This one is disabled',
  },
];

export function DummyChoiceStep({
  value,
  onChange,
}: WizardStepProps<string | undefined, DummyFormData>) {
  return (
    <CardSelector
      label="Pick an option"
      labelInfoButton={{
        title: 'What is this?',
        content: <p>A test of the CardSelector component with an info button.</p>,
      }}
      options={OPTIONS}
      value={value ?? ''}
      onChange={onChange}
      layout="horizontal"
    />
  );
}
