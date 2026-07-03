import { useState, useEffect, useCallback } from 'react';
import { sb } from './supabase.js';

// React hook version of the single-file app's FishAuth controller.
// Provides sign-in (Google OAuth), sign-out, and live auth state.
//
// Readiness comes from getSession() — a local read that resolves immediately
// and never hangs on the network (unlike getUser(), which round-trips to
// validate the token and can stall when offline or misconfigured, leaving the
// UI stuck on "Cloud…"). onAuthStateChange keeps state live after that, and a
// safety timeout guarantees `ready` flips even if the SDK never calls back.
export function useAuth() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const applySession = useCallback((session) => {
    setUser(session && session.user ? session.user : null);
    setReady(true);
  }, []);

  useEffect(() => {
    let done = false;

    sb.auth.getSession()
      .then(({ data }) => { if (!done) { done = true; applySession(data ? data.session : null); } })
      .catch(() => { if (!done) { done = true; applySession(null); } });

    // Safety net: never leave the UI gated on "Cloud…" if the call never settles.
    const t = setTimeout(() => { if (!done) { done = true; applySession(null); } }, 4000);

    const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => applySession(session));

    return () => {
      clearTimeout(t);
      sub && sub.subscription && sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async () => {
    // Google OAuth — redirects to Google, returns to this exact page.
    return sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href }
    });
  }, []);

  const signOut = useCallback(async () => {
    await sb.auth.signOut();
    applySession(null);
  }, [applySession]);

  return { user, ready, signedIn: !!user, email: user?.email || null, signIn, signOut };
}
