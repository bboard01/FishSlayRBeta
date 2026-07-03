import { useState, useEffect, useCallback } from 'react';
import { sb } from './supabase.js';

// React hook version of the single-file app's FishAuth controller.
// Provides sign-in (Google OAuth), sign-out, and live auth state.
export function useAuth() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await sb.auth.getUser();
      setUser(data && data.user ? data.user : null);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = sb.auth.onAuthStateChange(() => refresh());
    return () => { sub && sub.subscription && sub.subscription.unsubscribe(); };
  }, [refresh]);

  const signIn = useCallback(async () => {
    // Google OAuth — redirects to Google, returns to this exact page.
    return sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href }
    });
  }, []);

  const signOut = useCallback(async () => {
    await sb.auth.signOut();
    await refresh();
  }, [refresh]);

  return { user, ready, signedIn: !!user, email: user?.email || null, signIn, signOut };
}
