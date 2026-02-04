import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleCallback } from '../services/arkhamDBAuth';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

/**
 * OAuth callback page for ArkhamDB authentication
 * Handles the redirect from ArkhamDB OAuth, exchanges code for tokens,
 * and redirects back to the deck builder
 */
export function ArkhamDBCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for OAuth error
      if (errorParam) {
        setStatus('error');
        setError(errorDescription || errorParam || 'Authorization was denied.');
        return;
      }

      // Validate required params
      if (!code || !state) {
        setStatus('error');
        setError('Invalid callback. Missing authorization code or state.');
        return;
      }

      // Exchange code for tokens
      const result = await handleCallback(code, state);

      if (result.success) {
        setStatus('success');
        // Redirect after brief success message
        setTimeout(() => {
          navigate(result.returnPath || '/arkham/deck-builder', { replace: true });
        }, 1500);
      } else {
        setStatus('error');
        setError(result.error || 'Failed to complete authorization.');
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-cc-dark flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-cc-card border border-cc-border rounded-xl p-8 text-center">
          {status === 'processing' && (
            <>
              <Loader2 className="w-12 h-12 text-gold-400 animate-spin mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-white mb-2">
                Connecting to ArkhamDB
              </h1>
              <p className="text-gray-400">
                Completing authorization...
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h1 className="text-xl font-semibold text-white mb-2">
                Connected!
              </h1>
              <p className="text-gray-400">
                Your ArkhamDB account is now linked. Redirecting...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <h1 className="text-xl font-semibold text-white mb-2">
                Connection Failed
              </h1>
              <p className="text-red-400 mb-6">
                {error}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => navigate('/arkham/deck-builder', { replace: true })}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ArkhamDBCallback;
