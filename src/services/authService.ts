import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export async function signUp(
  email: string,
  password: string,
  businessName: string,
  businessCategory: string
): Promise<User> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: businessName,
        business_category: businessCategory,
      },
    },
  });
  if (error) throw error;

  const user = data.user!;

  // Create businesses row — id = user.id preserves the Firebase uid==businessId convention
  const { error: dbError } = await supabase.from('businesses').insert({
    id: user.id,
    owner_user_id: user.id,
    name: businessName,
    email,
    business_category: businessCategory,
    status: 'approved',
  });
  if (dbError) {
    console.warn('Notice: Business row insert deferred or blocked by RLS during signup:', dbError);
  }

  return user;
}

export async function logIn(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function logOut(): Promise<void> {
  await supabase.auth.signOut();
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}
