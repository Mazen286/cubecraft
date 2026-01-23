import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import type { DraftSettings } from '../types';
import { cn } from '../lib/utils';

const DEFAULT_SETTINGS: DraftSettings = {
  mode: 'pack',
  playerCount: 4,
  cardsPerPlayer: 45,
  packSize: 15,
  timerSeconds: 60,
  isMultiplayer: false,
};

export function DraftSetup() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<DraftSettings>(DEFAULT_SETTINGS);
  const [selectedCube, setSelectedCube] = useState<string>('mazcube');

  const handleStartDraft = () => {
    // TODO: Create draft session and navigate
    navigate('/draft', { state: { settings, cubeId: selectedCube } });
  };

  const updateSetting = <K extends keyof DraftSettings>(
    key: K,
    value: DraftSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Draft Setup</h1>
        <p className="text-gray-400 mb-8">Configure your draft session</p>

        {/* Cube Selection */}
        <Section title="Select Cube">
          <div className="grid grid-cols-2 gap-4">
            <CubeOption
              name="MazCube"
              description="1,005 cards - Balanced cube"
              selected={selectedCube === 'mazcube'}
              onClick={() => setSelectedCube('mazcube')}
            />
            <CubeOption
              name="Custom Cube"
              description="Upload your own"
              selected={selectedCube === 'custom'}
              onClick={() => setSelectedCube('custom')}
              disabled
            />
          </div>
        </Section>

        {/* Draft Mode */}
        <Section title="Draft Mode">
          <div className="grid grid-cols-2 gap-4">
            <ModeOption
              title="Pack Draft"
              description="Traditional format. Pick one card, pass the rest."
              selected={settings.mode === 'pack'}
              onClick={() => updateSetting('mode', 'pack')}
            />
            <ModeOption
              title="Open Draft"
              description="All cards visible. Take turns picking."
              selected={settings.mode === 'open'}
              onClick={() => updateSetting('mode', 'open')}
              disabled
            />
          </div>
        </Section>

        {/* Settings */}
        <Section title="Settings">
          <div className="space-y-4">
            <SettingRow label="Players">
              <select
                value={settings.playerCount}
                onChange={(e) =>
                  updateSetting('playerCount', parseInt(e.target.value))
                }
                className="bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
              >
                {[2, 4, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} Players
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Cards per Player">
              <select
                value={settings.cardsPerPlayer}
                onChange={(e) =>
                  updateSetting('cardsPerPlayer', parseInt(e.target.value))
                }
                className="bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
              >
                {[30, 45, 60, 75].map((n) => (
                  <option key={n} value={n}>
                    {n} Cards
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Pack Size">
              <select
                value={settings.packSize}
                onChange={(e) =>
                  updateSetting('packSize', parseInt(e.target.value))
                }
                className="bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
              >
                {[5, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>
                    {n} Cards
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Timer">
              <select
                value={settings.timerSeconds}
                onChange={(e) =>
                  updateSetting('timerSeconds', parseInt(e.target.value))
                }
                className="bg-yugi-card border border-yugi-border rounded-lg px-3 py-2 text-white focus:border-gold-500 focus:outline-none"
              >
                {[30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>
                    {n} Seconds
                  </option>
                ))}
              </select>
            </SettingRow>
          </div>
        </Section>

        {/* Game Mode */}
        <Section title="Game Mode">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => updateSetting('isMultiplayer', false)}
              className={cn(
                'p-4 rounded-lg border transition-all text-left',
                !settings.isMultiplayer
                  ? 'border-gold-500 bg-gold-500/10'
                  : 'border-yugi-border bg-yugi-card hover:border-yugi-border'
              )}
            >
              <div className="font-semibold text-white mb-1">Solo Draft</div>
              <div className="text-sm text-gray-400">
                Draft against AI opponents
              </div>
            </button>
            <button
              onClick={() => updateSetting('isMultiplayer', true)}
              className={cn(
                'p-4 rounded-lg border transition-all text-left',
                settings.isMultiplayer
                  ? 'border-gold-500 bg-gold-500/10'
                  : 'border-yugi-border bg-yugi-card hover:border-yugi-border'
              )}
            >
              <div className="font-semibold text-white mb-1">Multiplayer</div>
              <div className="text-sm text-gray-400">
                Create room for friends
              </div>
            </button>
          </div>
        </Section>

        {/* Actions */}
        <div className="flex gap-4 mt-8">
          <Button variant="secondary" onClick={() => navigate('/')}>
            Back
          </Button>
          <Button onClick={handleStartDraft} className="flex-1">
            {settings.isMultiplayer ? 'Create Room' : 'Start Draft'}
          </Button>
        </div>
      </div>
    </Layout>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

function CubeOption({
  name,
  description,
  selected,
  onClick,
  disabled,
}: {
  name: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-4 rounded-lg border transition-all text-left',
        selected
          ? 'border-gold-500 bg-gold-500/10'
          : 'border-yugi-border bg-yugi-card hover:border-yugi-border',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="font-semibold text-white mb-1">{name}</div>
      <div className="text-sm text-gray-400">{description}</div>
    </button>
  );
}

function ModeOption({
  title,
  description,
  selected,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-4 rounded-lg border transition-all text-left',
        selected
          ? 'border-gold-500 bg-gold-500/10'
          : 'border-yugi-border bg-yugi-card hover:border-yugi-border',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="font-semibold text-white mb-1">{title}</div>
      <div className="text-sm text-gray-400">{description}</div>
      {disabled && (
        <span className="text-xs text-gold-500 mt-2 inline-block">
          Coming Soon
        </span>
      )}
    </button>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-gray-300">{label}</label>
      {children}
    </div>
  );
}
