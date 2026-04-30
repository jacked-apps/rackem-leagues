import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CardAction, CardFooter } from '@/components/ui/card';
import { LoginCard } from './LoginCard';
import { Mail } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleForgotPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!email) {
      setMessage('Please enter your email address');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
      setLoading(false);
    } else {
      setEmailSent(true);
      setLoading(false);
    }
  };

  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const handleResendEmail = async () => {
    setResendLoading(true);
    setResendMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setResendMessage(`Error: ${error.message}`);
    } else {
      setResendMessage('Reset email sent!');
    }
    setResendLoading(false);
  };

  // Show success card after email is sent
  if (emailSent) {
    return (
      <LoginCard
        title="Check Your Email"
        description="We sent you a password reset link"
      >
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Mail className="h-16 w-16 text-blue-600" />
          </div>
          <p className="text-foreground">
            We sent a password reset link to <strong>{email}</strong>
          </p>
          <p className="text-muted-foreground text-sm">
            Click the link in your email to reset your password. The link will expire in 1 hour.
          </p>
          <div className="pt-4 space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open('https://gmail.com', '_blank')}
            >
              Open Gmail
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open('https://outlook.com', '_blank')}
            >
              Open Outlook
            </Button>
          </div>
          <div className="pt-2 border-t">
            <p className="text-muted-foreground text-sm mb-2">Didn't receive the email?</p>
            <Button
              variant="ghost"
              className="w-full"
              onClick={handleResendEmail}
              disabled={resendLoading}
            >
              {resendLoading ? 'Sending...' : 'Resend Reset Link'}
            </Button>
            {resendMessage && (
              <p className={`text-sm mt-2 ${resendMessage.includes('Error') ? 'text-red-500' : 'text-green-600'}`}>
                {resendMessage}
              </p>
            )}
          </div>
        </div>
        <CardFooter className="mt-4 text-sm flex justify-around w-full">
          <Link to="/login">Back to Login</Link>
        </CardFooter>
      </LoginCard>
    );
  }

  return (
    <LoginCard title="Reset Password" description="Enter your email to receive a password reset link">
      <form onSubmit={handleForgotPassword}>
        <div className="mb-4">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <CardAction>
          <Button type="submit" loadingText="Sending..." isLoading={loading} disabled={loading} message={message}>
            Send Reset Link
          </Button>
        </CardAction>
      </form>
      <CardFooter className="mt-4 text-sm flex justify-around w-full">
        <Link to="/login">Back to Login</Link>
        <Link to="/register">Create Account</Link>
      </CardFooter>
    </LoginCard>
  );
};