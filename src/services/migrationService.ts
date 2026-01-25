// Migration Service - handles migrating anonymous user data to authenticated accounts

import { getSupabase } from '../lib/supabase';

export const migrationService = {
  /**
   * Check if an anonymous user has any data that can be migrated
   */
  async hasAnonymousData(anonymousUserId: string): Promise<boolean> {
    const supabase = getSupabase();

    // Check if any cubes are owned by this anonymous ID
    const { count } = await supabase
      .from('cubes')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', anonymousUserId);

    return (count ?? 0) > 0;
  },

  /**
   * Check if anonymous data has already been migrated
   */
  async isMigrated(anonymousUserId: string): Promise<boolean> {
    const supabase = getSupabase();

    const { data } = await supabase
      .from('anonymous_migrations')
      .select('id')
      .eq('anonymous_user_id', anonymousUserId)
      .single();

    return !!data;
  },

  /**
   * Get count of items that can be migrated
   */
  async getMigrationStats(anonymousUserId: string): Promise<{
    cubes: number;
  }> {
    const supabase = getSupabase();

    const { count: cubeCount } = await supabase
      .from('cubes')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', anonymousUserId);

    return {
      cubes: cubeCount ?? 0,
    };
  },

  /**
   * Migrate all anonymous data to an authenticated account
   */
  async migrateData(
    authUserId: string,
    anonymousUserId: string
  ): Promise<{ success: boolean; error?: string; cubesMigrated: number }> {
    const supabase = getSupabase();

    try {
      // Check if already migrated
      const alreadyMigrated = await this.isMigrated(anonymousUserId);
      if (alreadyMigrated) {
        return { success: true, cubesMigrated: 0 };
      }

      // Get count of cubes to migrate
      const stats = await this.getMigrationStats(anonymousUserId);

      // Migrate cubes
      if (stats.cubes > 0) {
        const { error: cubeError } = await supabase
          .from('cubes')
          .update({ creator_id: authUserId })
          .eq('creator_id', anonymousUserId);

        if (cubeError) {
          return { success: false, error: cubeError.message, cubesMigrated: 0 };
        }
      }

      // Update user profile with anonymous ID link
      await supabase
        .from('user_profiles')
        .update({ anonymous_user_id: anonymousUserId })
        .eq('id', authUserId);

      // Record migration
      await supabase.from('anonymous_migrations').insert({
        anonymous_user_id: anonymousUserId,
        auth_user_id: authUserId,
      });

      return { success: true, cubesMigrated: stats.cubes };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cubesMigrated: 0,
      };
    }
  },
};
