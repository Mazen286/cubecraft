import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { Layout } from '../components/layout/Layout';

/**
 * OAuth callback page
 * Handles the redirect from OAuth providers (Google)
 */
export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = getSupabase();

      // Get the session from the URL hash
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setError(error.message);
        return;
      }

      if (data.session) {
        // Success - redirect to home
        navigate('/', { replace: true });
      } else {
        // Check URL for error
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const urlError = hashParams.get('error_description') || hashParams.get('error');

        if (urlError) {
          setError(decodeURIComponent(urlError));
        } else {
          // No session and no error - might still be processing
          // Wait a moment and check again
          setTimeout(async () => {
            const { data: retryData } = await supabase.auth.getSession();
            if (retryData.session) {
              navigate('/', { replace: true });
            } else {
              setError('Authentication failed. Please try again.');
            }
          }, 1000);
        }
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <Layout>
        <div className="max-w-md mx-auto text-center py-12">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Authentication Error</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-2 border-gold-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Completing sign in...</p>
      </div>
    </Layout>
  );
}

export default AuthCallback;
