import { create } from 'zustand';
import { User } from 'firebase/auth';
import { logOut as firebaseLogOut } from '../services/authService';

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
    businessId: user ? user.uid : null,
    businessName: user ? (user.displayName || null) : null
  }),
  setLoading: (isLoading) => set({ isLoading }),
  fetchBusinessProfile: async () => {
    const user = get().user;
    if (!user) return;
    
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const docRef = doc(db, 'businesses', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.businessName) {
          set({ businessName: data.businessName });
        }
      }
    } catch (err) {
      console.error('Failed to fetch business profile:', err);
    }
  },
  logOut: async () => {
    await firebaseLogOut();
    set({ user: null, businessId: null, businessName: null });
  }
}));
