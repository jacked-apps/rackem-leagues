import { playerFormSchema } from '../schemas/playerSchema';
import { capitalizeWords, formatFinalPhoneNumber } from '../utils/formatters';
import { generateNickname } from '../utils/nicknameGenerator';
import { supabase } from '../supabaseClient';
import { useUser } from '../context/useUser';
import type { FormState } from './types';
import { logger } from '@/utils/logger';

interface UsePlayerFormSubmissionProps {
  state: FormState;
  onError: (errors: FormState['errors']) => void;
  onSuccess: () => void;
  onLoading: (loading: boolean) => void;
}

export const usePlayerFormSubmission = ({ state, onError, onSuccess, onLoading }: UsePlayerFormSubmissionProps) => {
  const { user } = useUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ensure user is authenticated
    if (!user) {
      onError({ general: 'You must be logged in to submit an application' });
      return;
    }

    // Client-side validation with Zod
    const result = playerFormSchema.safeParse({
      firstName: state.firstName,
      lastName: state.lastName,
      nickname: state.nickname,
      phone: state.phone,
      address: state.address,
      city: state.city,
      state: state.state,
      zipCode: state.zipCode,
      dateOfBirth: state.dateOfBirth,
    });

    if (!result.success) {
      // Handle validation errors
      const newErrors: FormState['errors'] = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof FormState['errors'];
        newErrors[field] = issue.message;
      });
      onError(newErrors);
      return;
    }

    try {
      // Start loading state
      onLoading(true);

      // Format the data for database insertion
      const formattedFirstName = capitalizeWords(result.data.firstName);
      const formattedLastName = capitalizeWords(result.data.lastName);

      // Generate nickname if not provided
      // If user left nickname blank, auto-generate one based on their name
      const finalNickname = result.data.nickname
        ? capitalizeWords(result.data.nickname)
        : generateNickname(formattedFirstName, formattedLastName);

      const memberData = {
        user_id: user.id, // Link to authenticated user
        first_name: formattedFirstName,
        last_name: formattedLastName,
        nickname: finalNickname, // Always has a value now (user-provided or auto-generated)
        phone: formatFinalPhoneNumber(result.data.phone),
        email: user.email?.toLowerCase() || '', // Use email from authenticated user
        address: capitalizeWords(result.data.address),
        city: capitalizeWords(result.data.city),
        state: result.data.state,
        zip_code: result.data.zipCode,
        date_of_birth: result.data.dateOfBirth,
        role: 'player' as const, // Default role for new members
      };

      // Insert member data into Supabase
      const { error: insertError } = await supabase
        .from('members')
        .insert(memberData);

      if (insertError) {
        // Handle database errors
        logger.error('Database error', { error: insertError.message });
        onError({ general: `Failed to save application: ${insertError.message}` });
        return;
      }

      // Success! Clear errors
      onSuccess();

      // Force a full page reload to My Teams
      // This ensures UserProvider refetches the session and the new member record is loaded
      // Using window.location instead of navigate() ensures the entire app state refreshes
      window.location.href = '/my-teams';

    } catch (error) {
      // Handle unexpected errors
      logger.error('Unexpected error', { error: error instanceof Error ? error.message : String(error) });
      onError({ general: 'An unexpected error occurred. Please try again.' });
    } finally {
      // Stop loading state
      onLoading(false);
    }
  };

  return { handleSubmit };
};