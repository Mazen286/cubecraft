/**
 * ArkhamDB OAuth2 Authentication Service
 * Handles OAuth flow for syncing decks to ArkhamDB
 */

import { getSupabase } from '../lib/supabase';

// ArkhamDB OAuth2 endpoints
const ARKHAMDB_AUTH_URL = 'https://arkhamdb.com/oauth/v2/auth';
const ARKHAMDB_TOKEN_URL = 'https://arkhamdb.com/oauth/v2/token';

// Get OAuth config from environment
const getOAuthConfig = () => ({
  clientId: import.meta.env.VITE_ARKHAMDB_CLIENT_ID || '',
  redirectUri: import.meta.env.VITE_ARKHAMDB_REDIRECT_URI || `${window.location.origin}/auth/arkhamdb/callback`,
});

/**
 * Token data stored in Supabase
 */
export interface ArkhamDBTokenData {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  arkhamdb_user_id?: number;
  arkhamdb_username?: string;
}

/**
 * Connection status returned by isConnected
 */
export interface ArkhamDBConnectionStatus {
  connected: boolean;
  username?: string;
  userId?: number;
  expiresAt?: Date;
}

/**
 * Initiate OAuth2 authorization flow
 * Opens a new window/redirects to ArkhamDB login
 */
export function initiateAuth(): void {
  const config = getOAuthConfig();

  if (!config.clientId) {
    throw new Error('ArkhamDB OAuth not configured. Set VITE_ARKHAMDB_CLIENT_ID in environment.');
  }

  // Generate a random state for CSRF protection
  const state = crypto.randomUUID();
  sessionStorage.setItem('arkhamdb_oauth_state', state);

  // Store current deck ID to return to after auth
  const currentPath = window.location.pathname;
  if (currentPath.includes('/arkham/deck-builder/')) {
    sessionStorage.setItem('arkhamdb_return_path', currentPath);
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
  });

  window.location.href = `${ARKHAMDB_AUTH_URL}?${params.toString()}`;
}

/**
 * Handle OAuth callback - exchange authorization code for tokens
 */
export async function handleCallback(code: string, state: string): Promise<{
  success: boolean;
  error?: string;
  returnPath?: string;
}> {
  // Verify state to prevent CSRF
  const savedState = sessionStorage.getItem('arkhamdb_oauth_state');
  sessionStorage.removeItem('arkhamdb_oauth_state');

  if (state !== savedState) {
    return { success: false, error: 'Invalid OAuth state. Please try again.' };
  }

  const config = getOAuthConfig();
  const supabase = getSupabase();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'You must be logged in to connect ArkhamDB.' };
  }

  try {
    // Exchange code for tokens
    // Note: This should ideally go through a backend to keep client_secret secure
    // For now, we'll use a direct call (client_secret would need to be handled securely)
    const tokenResponse = await fetch(ARKHAMDB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        // Note: client_secret should be handled server-side in production
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error_description || 'Failed to exchange authorization code.'
      };
    }

    const tokenData = await tokenResponse.json();

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600));

    // Store tokens in Supabase
    const { error: upsertError } = await supabase
      .from('arkhamdb_tokens')
      .upsert({
        user_id: user.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      return { success: false, error: 'Failed to save authorization. Please try again.' };
    }

    // Get and store ArkhamDB user info
    try {
      const userInfo = await fetchArkhamDBUser(tokenData.access_token);
      if (userInfo) {
        await supabase
          .from('arkhamdb_tokens')
          .update({
            arkhamdb_user_id: userInfo.id,
            arkhamdb_username: userInfo.username,
          })
          .eq('user_id', user.id);
      }
    } catch {
      // Non-fatal - continue even if we can't get user info
    }

    // Get return path
    const returnPath = sessionStorage.getItem('arkhamdb_return_path');
    sessionStorage.removeItem('arkhamdb_return_path');

    return { success: true, returnPath: returnPath || '/arkham/deck-builder' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete authorization.'
    };
  }
}

/**
 * Fetch ArkhamDB user info using access token
 */
async function fetchArkhamDBUser(accessToken: string): Promise<{ id: number; username: string } | null> {
  const response = await fetch('https://arkhamdb.com/api/oauth2/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

/**
 * Refresh expired access token
 */
export async function refreshToken(): Promise<string | null> {
  const supabase = getSupabase();
  const config = getOAuthConfig();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get current tokens
  const { data: tokenData } = await supabase
    .from('arkhamdb_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!tokenData?.refresh_token) return null;

  try {
    const response = await fetch(ARKHAMDB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenData.refresh_token,
        client_id: config.clientId,
      }),
    });

    if (!response.ok) {
      // Refresh failed - clear tokens
      await disconnect();
      return null;
    }

    const newTokenData = await response.json();

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (newTokenData.expires_in || 3600));

    // Update stored tokens
    await supabase
      .from('arkhamdb_tokens')
      .update({
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token || tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
      })
      .eq('user_id', user.id);

    return newTokenData.access_token;
  } catch {
    return null;
  }
}

/**
 * Get current valid access token, refreshing if necessary
 */
export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tokenData } = await supabase
    .from('arkhamdb_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!tokenData) return null;

  // Check if token is expired (with 5 minute buffer)
  const expiresAt = new Date(tokenData.expires_at);
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);

  if (expiresAt <= now) {
    // Token expired or expiring soon - refresh it
    return refreshToken();
  }

  return tokenData.access_token;
}

/**
 * Check if user has valid ArkhamDB connection
 */
export async function isConnected(): Promise<ArkhamDBConnectionStatus> {
  const supabase = getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { connected: false };

  const { data: tokenData } = await supabase
    .from('arkhamdb_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!tokenData) return { connected: false };

  // Check if token is still valid
  const expiresAt = new Date(tokenData.expires_at);
  if (expiresAt <= new Date()) {
    // Try to refresh
    const newToken = await refreshToken();
    if (!newToken) {
      return { connected: false };
    }
  }

  return {
    connected: true,
    username: tokenData.arkhamdb_username || undefined,
    userId: tokenData.arkhamdb_user_id || undefined,
    expiresAt,
  };
}

/**
 * Disconnect from ArkhamDB - clear stored tokens
 */
export async function disconnect(): Promise<void> {
  const supabase = getSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('arkhamdb_tokens')
    .delete()
    .eq('user_id', user.id);
}

/**
 * Check if ArkhamDB OAuth is configured
 */
export function isOAuthConfigured(): boolean {
  const config = getOAuthConfig();
  return Boolean(config.clientId);
}
