import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '../config';

export const familyConfigured = SUPABASE_URL.startsWith('https://') && !SUPABASE_KEY.startsWith('PASTE');

export const supabase: SupabaseClient | null = familyConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/** Make sure this phone has a (silent, anonymous) account. Returns the user id. */
export async function ensureSignedIn(): Promise<string> {
  if (!supabase) throw new Error('Family sync is not set up yet (see src/config.ts).');
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const res = await supabase.auth.signInAnonymously();
  if (res.error || !res.data.user) {
    throw new Error(
      res.error?.message?.includes('Anonymous')
        ? 'Turn on "Anonymous sign-ins" in Supabase → Authentication → Sign In / Providers.'
        : res.error?.message ?? 'Could not sign in',
    );
  }
  return res.data.user.id;
}
