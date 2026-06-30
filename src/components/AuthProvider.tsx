'use client';

import { useEffect } from 'react';
import { subscribeToAuthChanges } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (user) => {
      setUser(user);
      if (user) {
        const store = useAuthStore.getState();
        await store.fetchBusinessProfile();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  return <>{children}</>;
}
