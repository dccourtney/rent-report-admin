import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  loading: boolean;
  error: string | null;

  login: () => Promise<void>;
  loginWithEmail: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
  handleAuthCallback: () => Promise<void>;
  getToken: () => Promise<string | null>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  token: null,
  loading: false,
  error: null,

  login: async () => {
    try {
      set({ loading: true, error: null });

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/callback`,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });

      if (error) throw error;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed';
      console.error('Login error:', error);
      set({ error: message, loading: false });
      throw error;
    }
  },

  // Passwordless email sign-in. Sends a magic link that lands on /callback,
  // where the existing SIGNED_IN handler establishes the session (same as OAuth).
  // Component-local UI state ("check your email") is managed by the caller, so
  // this deliberately does not touch the shared loading flag.
  loginWithEmail: async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    });
    if (error) throw error;
  },

  // Verify the 6-digit code from the sign-in email. On success a session is
  // established directly (no redirect / no PKCE verifier needed — so this also
  // works cross-device). Caller routes to /callback to reuse post-login routing.
  verifyEmailOtp: async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
  },

  logout: async () => {
    try {
      set({ loading: true });
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      set({
        user: null,
        isAuthenticated: false,
        token: null,
        loading: false
      });

      window.location.href = '/';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      console.error('Logout error:', error);
      set({ error: message, loading: false });
      window.location.href = '/';
    }
  },

  checkAuthStatus: async () => {
    const state = get();
    if (state.loading) {
      return;
    }

    try {
      set({ loading: true });
      // getSession first — it can establish the session from the URL hash
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const user = session.user;
        const userProfile = {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
          picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || null
        };

        set({
          user: userProfile,
          isAuthenticated: true,
          token: session.access_token,
          loading: false
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          token: null,
          loading: false
        });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      set({
        user: null,
        isAuthenticated: false,
        token: null,
        loading: false
      });
    }
  },

  handleAuthCallback: async () => {
    try {
      set({ loading: true });

      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (session?.user) {
        const userProfile = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0],
          picture: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null
        };

        set({
          user: userProfile,
          isAuthenticated: true,
          token: session.access_token,
          loading: false
        });
      } else {
        throw new Error('No session found after OAuth callback');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed';
      console.error('Auth callback error:', error);
      set({ error: message, loading: false });
      throw error;
    }
  },

  getToken: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  clearError: () => {
    set({ error: null });
  }
}));

// Initialize auth state listener
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    const userProfile = {
      id: session.user.id,
      email: session.user.email || '',
      name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0],
      picture: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null
    };

    useAuthStore.setState({
      user: userProfile,
      isAuthenticated: true,
      token: session.access_token
    });
  } else if (event === 'SIGNED_OUT') {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      token: null
    });
  }
});
