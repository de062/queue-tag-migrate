import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { logOut as supabaseLogOut } from '../services/authService';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  businessId: string | null;
  businessName: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  fetchBusinessProfile: () => Promise<void>;
  logOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  businessId: null,
  businessName: null,
  isLoading: true,

  setUser: (user) => set({
    user,
    businessId: user?.id ?? null,
    businessName: user?.user_metadata?.full_name ?? null,
  }),

  setLoading: (isLoading) => set({ isLoading }),

  fetchBusinessProfile: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const { data } = await supabase
        .from('businesses')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.name) set({ businessName: data.name });
    } catch (err) {
      console.error('Failed to fetch business profile:', err);
    }
  },

  logOut: async () => {
    await supabaseLogOut();
    set({ user: null, businessId: null, businessName: null });
  },
}));
