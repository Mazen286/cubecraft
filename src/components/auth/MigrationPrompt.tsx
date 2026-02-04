import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { migrationService } from '../../services/migrationService';

/**
 * Shows a prompt to link anonymous data when a user logs in
 * Appears as a toast in the bottom-right corner
 */
export function MigrationPrompt() {
  const { user, anonymousUserId, migrateAnonymousData } = useAuth();
  const [hasData, setHasData] = useState(false);
  const [stats, setStats] = useState<{ cubes: number }>({ cubes: 0 });
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Only check if user is logged in and we have an anonymous ID
    if (!user || !anonymousUserId) {
      setHasData(false);
      return;
    }

    // Don't show if already linked
    if (user.anonymousUserId === anonymousUserId) {
      setHasData(false);
      return;
    }

    // Check if there's anonymous data to migrate
    const checkData = async () => {
      const hasMigratable = await migrationService.hasAnonymousData(anonymousUserId);
      if (hasMigratable) {
        const migrationStats = await migrationService.getMigrationStats(anonymousUserId);
        setStats(migrationStats);
        setHasData(true);
      }
    };

    checkData();
  }, [user, anonymousUserId]);

  // Don't render if no data to migrate or already dismissed
  if (!hasData || isDismissed || !user) {
    return null;
  }

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      await migrateAnonymousData();
      setShowSuccess(true);
      setTimeout(() => {
        setHasData(false);
        setShowSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Migration failed:', err);
    } finally {
      setIsMigrating(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-green-900/90 border border-green-700 rounded-lg p-4 max-w-sm shadow-xl">
        <div className="flex items-center gap-3">
          <div className="text-green-400 text-xl">✓</div>
          <div>
            <p className="text-green-300 font-medium">Cubes Linked!</p>
            <p className="text-green-400/80 text-sm">
              {stats.cubes} cube{stats.cubes !== 1 ? 's' : ''} linked to your account
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-cc-dark border border-cc-border rounded-lg p-4 max-w-sm shadow-xl">
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-300 text-lg"
      >
        ×
      </button>

      <h3 className="font-semibold text-white mb-2 pr-6">Link Your Cubes</h3>
      <p className="text-sm text-gray-400 mb-3">
        We found <span className="text-gold-400 font-medium">{stats.cubes}</span> cube
        {stats.cubes !== 1 ? 's' : ''} you created before signing in.
        Would you like to link {stats.cubes !== 1 ? 'them' : 'it'} to your account?
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleMigrate}
          disabled={isMigrating}
          className="flex-1 px-3 py-2 bg-gold-600 hover:bg-gold-500 disabled:bg-gray-700 text-black disabled:text-gray-500 font-medium text-sm rounded transition-colors"
        >
          {isMigrating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Linking...
            </span>
          ) : (
            'Link Cubes'
          )}
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="px-3 py-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

export default MigrationPrompt;
