/**
 * User profile stored in user_profiles table
 */
export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  anonymousUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Auth state
 */
export interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  anonymousUserId: string; // Always available - the browser's localStorage UUID
}

/**
 * Auth context value with methods
 */
export interface AuthContextValue extends AuthState {
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserProfile, 'displayName' | 'avatarUrl'>>) => Promise<void>;
  migrateAnonymousData: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

/**
 * Database row types for user_profiles table
 */
export interface UserProfileRow {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  role: 'user' | 'admin';
  anonymous_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfileInsert {
  id?: string;
  email?: string | null;
  display_name: string;
  avatar_url?: string | null;
  role?: 'user' | 'admin';
  anonymous_user_id?: string | null;
}

export interface UserProfileUpdate {
  display_name?: string;
  avatar_url?: string | null;
  role?: 'user' | 'admin';
  anonymous_user_id?: string | null;
  updated_at?: string;
}

/**
 * Database row types for anonymous_migrations table
 */
export interface AnonymousMigrationRow {
  id: string;
  anonymous_user_id: string;
  auth_user_id: string;
  migrated_at: string;
}

export interface AnonymousMigrationInsert {
  id?: string;
  anonymous_user_id: string;
  auth_user_id: string;
}
