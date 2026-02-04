import { useState, useEffect, useCallback } from 'react';
import { Link2, Link2Off, Loader2, ExternalLink } from 'lucide-react';
import {
  isConnected,
  initiateAuth,
  disconnect,
  isOAuthConfigured,
  type ArkhamDBConnectionStatus as ConnectionStatus,
} from '../../services/arkhamDBAuth';

interface ArkhamDBConnectionStatusProps {
  compact?: boolean;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Component showing ArkhamDB connection status with connect/disconnect buttons
 */
export function ArkhamDBConnectionStatus({
  compact = false,
  onConnectionChange,
}: ArkhamDBConnectionStatusProps) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const checkConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const connectionStatus = await isConnected();
      setStatus(connectionStatus);
      onConnectionChange?.(connectionStatus.connected);
    } catch {
      setStatus({ connected: false });
      onConnectionChange?.(false);
    } finally {
      setIsLoading(false);
    }
  }, [onConnectionChange]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleConnect = () => {
    try {
      initiateAuth();
    } catch (error) {
      console.error('Failed to initiate auth:', error);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnect();
      setStatus({ connected: false });
      onConnectionChange?.(false);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // OAuth not configured
  if (!isOAuthConfigured()) {
    if (compact) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-gray-500" title="Set VITE_ARKHAMDB_CLIENT_ID to enable sync">
          <Link2Off className="w-3 h-3" />
          <span>Sync disabled</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link2Off className="w-3 h-3" />
        <span>ArkhamDB sync not configured</span>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    if (compact) {
      return <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />;
    }

    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Checking connection...</span>
      </div>
    );
  }

  // Connected
  if (status?.connected) {
    if (compact) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <Link2 className="w-3 h-3" />
            <span>{status.username || 'Connected'}</span>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            title="Disconnect from ArkhamDB"
          >
            {isDisconnecting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Link2Off className="w-3 h-3" />
            )}
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-800 rounded-lg">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
            <Link2 className="w-4 h-4" />
            <span>Connected to ArkhamDB</span>
          </div>
          {status.username && (
            <p className="text-xs text-gray-400 mt-0.5">
              as {status.username}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://arkhamdb.com/user/profile"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-400 hover:text-white transition-colors"
            title="View ArkhamDB profile"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="px-3 py-1.5 text-xs text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 rounded transition-colors disabled:opacity-50"
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>
    );
  }

  // Not connected
  if (compact) {
    return (
      <button
        onClick={handleConnect}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gold-400 transition-colors"
        title="Connect to ArkhamDB"
      >
        <Link2Off className="w-3 h-3" />
        <span>Connect</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-cc-darker border border-cc-border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Link2Off className="w-4 h-4" />
          <span>Not connected to ArkhamDB</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Connect to sync decks and get TTS deck IDs
        </p>
      </div>
      <button
        onClick={handleConnect}
        className="px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black text-sm font-medium rounded-lg transition-colors"
      >
        Connect
      </button>
    </div>
  );
}
