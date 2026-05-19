/**
 * @fileoverview Submission hook for the short profile form
 *
 * Handles form validation, data formatting, and database insertion
 * for the minimal registration form. Creates a member record with
 * only essential fields.
 */
import { shortProfileSchema } from '../schemas/shortProfileSchema';
import { capitalizeWords } from '../utils/formatters';
import { generateNickname } from '../utils/nicknameGenerator';
import { supabase } from '../supabaseClient';
import { useUser } from '../context/useUser';
import type { ShortProfileFormState } from './types';
import { logger } from '@/utils/logger';

interface UseShortProfileSubmissionProps {
  state: ShortProfileFormState;
  onError: (errors: ShortProfileFormState['errors']) => void;
  onSuccess: () => void;
  onLoading: (loading: boolean) => void;
}

/**
 * Custom hook for handling short profile form submission.
 *
 * Validates form data, formats values, and creates a member record
 * in Supabase with only the essential fields.
 *
 * @param props - State and callback handlers
 * @returns Object containing handleSubmit function
 *
 * @example
 * const { handleSubmit } = useShortProfileSubmission({
 *   state,
 *   onError: (errors) => dispatch({ type: 'SET_ERRORS', errors }),
 *   onSuccess: () => dispatch({ type: 'CLEAR_ERRORS' }),
 *   onLoading: (loading) => dispatch({ type: 'SET_LOADING', loading }),
 * });
 */
export const useShortProfileSubmission = ({
  state,
  onError,
  onSuccess,
  onLoading,
}: UseShortProfileSubmissionProps) => {
  const { user } = useUser();

  /**
   * Handles form submission.
   * Validates data, formats values, and inserts member record.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ensure user is authenticated
    if (!user) {
      onError({ general: 'You must be logged in to complete your profile' });
      return;
    }

    // Client-side validation with Zod
    const result = shortProfileSchema.safeParse({
      firstName: state.firstName,
      lastName: state.lastName,
      nickname: state.nickname,
      city: state.city,
      state: state.state,
    });

    if (!result.success) {
      // Map Zod errors to form errors
      const newErrors: ShortProfileFormState['errors'] = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof ShortProfileFormState['errors'];
        newErrors[field] = issue.message;
      });
      onError(newErrors);
      return;
    }

    try {
      onLoading(true);

      // Format the data for database insertion
      const formattedFirstName = capitalizeWords(result.data.firstName);
      const formattedLastName = capitalizeWords(result.data.lastName);

      // Generate nickname if not provided
      const finalNickname = result.data.nickname
        ? capitalizeWords(result.data.nickname)
        : generateNickname(formattedFirstName, formattedLastName);

      // Build member record with only essential fields
      // Optional fields (phone, address, zip_code, date_of_birth) are left null
      const memberData = {
        user_id: user.id,
        first_name: formattedFirstName,
        last_name: formattedLastName,
        nickname: finalNickname,
        email: user.email?.toLowerCase() || '',
        city: capitalizeWords(result.data.city),
        state: result.data.state,
        role: 'player' as const,
        // These fields are now nullable in the database:
        // phone: null,
        // address: null,
        // zip_code: null,
        // date_of_birth: null,
      };

      // Insert member record
      const { error: insertError } = await supabase
        .from('members')
        .insert(memberData);

      if (insertError) {
        logger.error('Database error during profile creation', {
          error: insertError.message,
        });
        onError({ general: `Failed to create profile: ${insertError.message}` });
        return;
      }

      onSuccess();

      // Force full page reload to My Teams to ensure UserProvider refetches member data
      window.location.href = '/my-teams';
    } catch (error) {
      logger.error('Unexpected error during profile creation', {
        error: error instanceof Error ? error.message : String(error),
      });
      onError({ general: 'An unexpected error occurred. Please try again.' });
    } finally {
      onLoading(false);
    }
  };

  return { handleSubmit };
};
