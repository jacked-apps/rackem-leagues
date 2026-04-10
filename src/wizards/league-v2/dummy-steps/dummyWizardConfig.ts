/**
 * @fileoverview Dummy wizard config — used to test the WizardShell in Phase 1
 *
 * Two-step wizard with a text input and a choice step. Wired into
 * LeagueWizardV2Page so we can manually verify navigation, step rendering,
 * and form state in the dev preview.
 *
 * Will be deleted in Phase 5 when the real league wizard config is built.
 */

import type { WizardConfig } from '@/components/wizard';
import { DummyTextStep } from './DummyTextStep';
import { DummyChoiceStep } from './DummyChoiceStep';
import type { DummyFormData } from './dummyTypes';

export const dummyWizardConfig: WizardConfig<DummyFormData> = {
  id: 'dummy-test-wizard',
  title: 'Wizard Shell Test',
  schemaVersion: 1,
  initialFormData: {},
  steps: [
    {
      id: 'dummy-text-step',
      title: 'Step 1: Text Input',
      subtitle: 'Verifying that text input flows through the shell',
      component: DummyTextStep as WizardConfig<DummyFormData>['steps'][number]['component'],
    },
    {
      id: 'dummy-choice-step',
      title: 'Step 2: Choice',
      subtitle: 'Verifying that categorical input flows through the shell',
      component: DummyChoiceStep as WizardConfig<DummyFormData>['steps'][number]['component'],
    },
  ],
};
