import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

// Trimmed for the admin app — only what's needed to gate on is_admin and show
// basic account info. The full profile shape lives in the main app.
export interface Profile {
  id: string;
  user_id: string;
  plan: string;
  plan_status: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: null,
      loading: false,
      error: null,

      fetchProfile: async () => {
        try {
          set({ loading: true, error: null });
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            set({ profile: null, loading: false });
            return;
          }
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
          if (error) throw error;
          set({ profile: data as Profile, loading: false });
        } catch (error) {
          console.error('Error fetching profile:', error);
          set({ error: 'Failed to load profile', loading: false });
        }
      },

      clearProfile: () => set({ profile: null, loading: false, error: null }),
    }),
    {
      name: 'rra-profile',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ profile: state.profile }),
    }
  )
);
