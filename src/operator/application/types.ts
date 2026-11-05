/**
 * @fileoverview League Operator Application Types
 * TypeScript interfaces and types for the league operator application form
 */
import type { Venue, ContactVisibilityLevel } from '../../schemas/leagueOperatorSchema';

/**
 * Application state management action types for useReducer
 */
export type ApplicationAction =
  | { type: 'SET_LEAGUE_NAME'; payload: string }
  | { type: 'SET_USE_PROFILE_ADDRESS'; payload: boolean }
  | { type: 'SET_ORGANIZATION_ADDRESS'; payload: string }
  | { type: 'SET_ORGANIZATION_CITY'; payload: string }
  | { type: 'SET_ORGANIZATION_STATE'; payload: string }
  | { type: 'SET_ORGANIZATION_ZIP_CODE'; payload: string }
  | { type: 'SET_CONTACT_DISCLAIMER_ACKNOWLEDGED'; payload: boolean }
  | { type: 'SET_USE_PROFILE_EMAIL'; payload: boolean }
  | { type: 'SET_LEAGUE_EMAIL'; payload: string }
  | { type: 'SET_EMAIL_VISIBILITY'; payload: ContactVisibilityLevel }
  | { type: 'SET_USE_PROFILE_PHONE'; payload: boolean }
  | { type: 'SET_LEAGUE_PHONE'; payload: string }
  | { type: 'SET_PHONE_VISIBILITY'; payload: ContactVisibilityLevel }
  | { type: 'SET_PAYMENT_INFO'; payload: {
      paymentToken: string;
      cardLast4: string;
      cardBrand: string;
      expiryMonth: number;
      expiryYear: number;
      billingZip: string;
      paymentVerified: boolean;
    } }
  | { type: 'ADD_VENUE'; payload: Venue }
  | {
      type: 'UPDATE_VENUE';
      payload: { id: string; field: keyof Venue; value: string | number };
    }
  | { type: 'SET_CONTACT_NAME'; payload: string }
  | { type: 'SET_CONTACT_EMAIL'; payload: string }
  | { type: 'SET_CONTACT_PHONE'; payload: string };

/**
 * Question configuration interface for survey steps
 */
export interface QuestionConfig {
  id: string;
  type: 'input' | 'choice';
  title: string;
  subtitle?: string;
  placeholder?: string;
  validator?: (value: string) => void;
  formatter?: (value: string) => string;
  infoTitle?: string;
  infoContent?: React.ReactNode;
}

/**
 * Choice question configuration extending base question
 */
export interface ChoiceQuestionConfig extends Omit<QuestionConfig, 'type' | 'placeholder' | 'validator' | 'formatter'> {
  type: 'choice';
  choices: Array<{
    value: string;
    label: string;
    variant?: 'default' | 'outline' | 'secondary';
  }>;
  content?: React.ReactNode;
  additionalContent?: React.ReactNode;
}