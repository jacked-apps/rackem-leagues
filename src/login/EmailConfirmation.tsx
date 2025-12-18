import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useUser } from '../context/useUser';
import { LoginCard } from './LoginCard';

export const EmailConfirmation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, setIsLoggedIn } = useUser();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Confirming your email...');

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Get the token from URL parameters
        const token = searchParams.get('token');
        const type = searchParams.get('type');

        if (type === 'signup' && token) {
          // Verify the email confirmation token
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
          });

          if (error) {
            setStatus('error');
            setMessage(`Confirmation failed: ${error.message}`);
            return;
          }

          if (data.user) {
            // User is now confirmed and logged in
            setUser(data.user);
            setIsLoggedIn(true);
            setStatus('success');
            setMessage('Email confirmed successfully! Redirecting...');

            // Redirect to dashboard after 2 seconds
            setTimeout(() => navigate('/dashboard'), 2000);
          }
        } else {
          setStatus('error');
          setMessage('Invalid confirmation link');
        }
      } catch (error) {
        setStatus('error');
        setMessage('An error occurred during confirmation');
      }
    };

    handleEmailConfirmation();
  }, [searchParams, navigate, setUser, setIsLoggedIn]);

  return (
    <LoginCard title="Email Confirmation">
      <div className="text-center">
        {status === 'loading' && (
          <div className="text-gray-600">{message}</div>
        )}
        {status === 'success' && (
          <div className="text-green-600">{message}</div>
        )}
        {status === 'error' && (
          <div className="text-red-600">{message}</div>
        )}
      </div>
    </LoginCard>
  );
};