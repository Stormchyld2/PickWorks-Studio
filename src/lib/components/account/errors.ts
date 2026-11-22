import { CoreError } from '$lib/services/core-client';

/** Plain-language message for an account error. */
export function friendlyError(e: unknown): string {
  if (!(e instanceof CoreError)) return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
  switch (e.code) {
    case 'wrong-password':
      return 'That password is not right. Check it and try again.';
    case 'throttled':
      return `Too many tries. Please wait ${formatWait(e.retryAfterSecs ?? 30)} before trying again.`;
    case 'weak-password':
      return 'Use at least 8 characters.';
    case 'inactive':
      return 'This profile is not active. Ask your administrator.';
    case 'unknown-student':
      return 'That profile no longer exists.';
    case 'no-session':
      return 'Your session has ended. Please sign in again.';
    case 'corrupt':
      return "This backup is damaged or incomplete, so it wasn't used. Nothing was changed. Try another copy.";
    case 'newer-version':
      return 'This was made by a newer version of PickWorks Studio. Update the app first.';
    case 'invalid-data':
      return e.message.replace(/^invalid data: /, '');
    default:
      return e.message;
  }
}

export function formatWait(secs: number): string {
  if (secs < 60) return `${secs} seconds`;
  const m = Math.ceil(secs / 60);
  return m === 1 ? '1 minute' : `${m} minutes`;
}
