import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getSupabase } from '../lib/supabase';
import type { AuthContextValue, UserProfile, AuthState, UserProfileRow } from '../types/auth';
import type { Session } from '@supabase/supabase-js';
import { getActiveGameConfig } from './GameContext';

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Get storage key prefix for the current game
 */
function getStoragePrefix(): string {
  try {
    return getActiveGameConfig().storageKeyPrefix;
  } catch {
    return 'yugioh-draft';
  }
}

/**
 * Get or create anonymous user ID from localStorage
 * This matches the pattern in draftService.ts for backward compatibility
 */
function getAnonymousUserId(): string {
  const key = `${getStoragePrefix()}-user-id`;
  let userId = localStorage.getItem(key);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(key, userId);
  }
  return userId;
}

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth context provider
 * Provides authentication state and methods to the entire app
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    isAdmin: false,
    anonymousUserId: '',
  });

  // Initialize anonymous user ID on mount (client-side only)
  useEffect(() => {
    setState(prev => ({
      ...prev,
      anonymousUserId: getAnonymousUserId(),
    }));
  }, []);

  const supabase = getSupabase();

  /**
   * Convert database row to UserProfile
   */
  const rowToProfile = useCallback((row: UserProfileRow): UserProfile => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    anonymousUserId: row.anonymous_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }), []);

  /**
   * Fetch user profile from database with timeout
   */
  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 5000);
    });

    const queryPromise = Promise.resolve(
      supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
    )
      .then(({ data, error }) => {
        if (error || !data) return null;
        return rowToProfile(data as UserProfileRow);
      })
      .catch(() => null);

    return Promise.race([queryPromise, timeoutPromise]);
  }, [supabase, rowToProfile]);

  /**
   * Handle session change
   */
  const handleSession = useCallback(async (session: Session | null) => {
    try {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);

        setState(prev => {
          // If we already have a profile for this user and the new fetch failed,
          // keep the existing profile (don't downgrade admin to user)
          if (!profile && prev.user?.id === session.user.id) {
            return { ...prev, isLoading: false };
          }

          // If fetch failed and no existing profile, create fallback
          if (!profile) {
            const meta = session.user.user_metadata;
            const fallback = {
              id: session.user.id,
              email: session.user.email || null,
              displayName: meta?.display_name || meta?.full_name || meta?.name || session.user.email?.split('@')[0] || 'User',
              avatarUrl: meta?.avatar_url || meta?.picture || null,
              role: 'user' as const,
              anonymousUserId: null,
              createdAt: session.user.created_at || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            return {
              ...prev,
              user: fallback,
              isLoading: false,
              isAuthenticated: true,
              isAdmin: false,
            };
          }

          // Use the fetched profile
          return {
            ...prev,
            user: profile,
            isLoading: false,
            isAuthenticated: true,
            isAdmin: profile.role === 'admin',
          };
        });
      } else {
        setState(prev => ({
          ...prev,
          user: null,
          isLoading: false,
          isAuthenticated: false,
          isAdmin: false,
        }));
      }
    } catch (error) {
      console.error('[Auth] Error handling session:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [fetchUserProfile]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        await handleSession(session);
      }
    );

    // Check initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        handleSession(session);
      })
      .catch((error) => {
        console.error('[Auth] Error getting initial session:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      });

    return () => subscription.unsubscribe();
  }, [supabase, handleSession]);

  /**
   * Sign in with email and password
   */
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, [supabase]);

  /**
   * Sign up with email and password
   */
  const signUpWithEmail = useCallback(async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    if (error) throw error;
  }, [supabase]);

  /**
   * Sign in with Google OAuth
   */
  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  }, [supabase]);

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [supabase]);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (
    updates: Partial<Pick<UserProfile, 'displayName' | 'avatarUrl'>>
  ) => {
    if (!state.user) throw new Error('Not authenticated');

    const dbUpdates: Record<string, unknown> = {};
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;

    const { error } = await supabase
      .from('user_profiles')
      .update(dbUpdates)
      .eq('id', state.user.id);

    if (error) throw error;

    // Refresh user data
    const profile = await fetchUserProfile(state.user.id);
    setState(prev => ({ ...prev, user: profile }));
  }, [supabase, state.user, fetchUserProfile]);

  /**
   * Migrate anonymous data to authenticated account
   */
  const migrateAnonymousData = useCallback(async () => {
    if (!state.user || !state.anonymousUserId) return;

    // Check if already migrated
    const { data: existing } = await supabase
      .from('anonymous_migrations')
      .select('id')
      .eq('anonymous_user_id', state.anonymousUserId)
      .single();

    if (existing) {
      console.log('Anonymous data already migrated');
      return;
    }

    // Update user profile with anonymous ID link
    await supabase
      .from('user_profiles')
      .update({ anonymous_user_id: state.anonymousUserId })
      .eq('id', state.user.id);

    // Migrate cubes owned by anonymous ID
    const { error: cubeError } = await supabase
      .from('cubes')
      .update({ creator_id: state.user.id })
      .eq('creator_id', state.anonymousUserId);

    if (cubeError) {
      console.error('Failed to migrate cubes:', cubeError);
    }

    // Record migration
    await supabase
      .from('anonymous_migrations')
      .insert({
        anonymous_user_id: state.anonymousUserId,
        auth_user_id: state.user.id,
      });

    // Refresh user profile
    const profile = await fetchUserProfile(state.user.id);
    setState(prev => ({ ...prev, user: profile }));
  }, [supabase, state.user, state.anonymousUserId, fetchUserProfile]);

  /**
   * Refresh user data from database
   */
  const refreshUser = useCallback(async () => {
    if (!state.user) return;
    const profile = await fetchUserProfile(state.user.id);
    setState(prev => ({
      ...prev,
      user: profile,
      isAdmin: profile?.role === 'admin',
    }));
  }, [state.user, fetchUserProfile]);

  const value: AuthContextValue = {
    ...state,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    updateProfile,
    migrateAnonymousData,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to get the effective user ID
 * Returns auth user ID if authenticated, otherwise returns anonymous ID
 * This is useful for cube ownership and similar features
 */
export function useEffectiveUserId(): string {
  const { user, anonymousUserId } = useAuth();
  return user?.id ?? anonymousUserId;
}

/**
 * Get effective user ID outside of React context
 * Returns auth user ID if authenticated, otherwise returns anonymous ID
 */
export async function getEffectiveUserId(): Promise<string> {
  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return session.user.id;
    }
  } catch {
    // Fall through to anonymous
  }
  return getAnonymousUserId();
}
