import { WebAuthError, WebAuthErrorCodes } from 'react-native-auth0';
import { ApiError } from '@/lib/api-client';

export const isUserCancelled = (error: unknown) => {
  if (error instanceof WebAuthError) {
    return error.type === WebAuthErrorCodes.USER_CANCELLED;
  }
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String(error.code) : '';
  const type = 'type' in error ? String(error.type) : '';
  const message = 'message' in error ? String(error.message) : '';
  return (
    code.includes('USER_CANCELLED') ||
    code.includes('user_cancelled') ||
    type === WebAuthErrorCodes.USER_CANCELLED ||
    /cancell?ed/i.test(message)
  );
};

export const isIdentityConflict = (error: unknown) =>
  error instanceof ApiError && error.status === 409;

export const errorMessage = (error: unknown, fallback = 'Something went wrong. Try again.') => {
  if (error instanceof ApiError && error.detail) return error.detail;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};
