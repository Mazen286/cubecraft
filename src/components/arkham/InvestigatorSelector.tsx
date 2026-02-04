import { useState, useMemo, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ChevronDown, RotateCw, Upload } from 'lucide-react';
import type { Investigator, ArkhamFaction } from '../../types/arkham';
import { FACTION_COLORS, FACTION_NAMES } from '../../config/games/arkham';
import { arkhamCardService } from '../../services/arkhamCardService';
import { SingleSkillIcon } from './ArkhamCardTable';

interface InvestigatorSelectorProps {
  investigators: Investigator[];
  onSelect: (investigator: Investigator) => void;
  onCancel?: () => void;
  onImport?: () => void;
}

export function InvestigatorSelector({
  investigators,
  onSelect,
  onCancel,
  onImport,
}: InvestigatorSelectorProps) {
  const [factionFilter, setFactionFilter] = useState<ArkhamFaction | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [backImageFailed, setBackImageFailed] = useState(false);
  const [frontImageFailed, setFrontImageFailed] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  // Filter investigators by faction (parallels and promos are now included from service)
  const filteredInvestigators = useMemo(() => {
    return investigators
      .filter(inv => {
        if (inv.hidden) return false;
        if (factionFilter && inv.faction_code !== factionFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        return a.code.localeCompare(b.code);
      });
  }, [investigators, factionFilter]);

  // Reset index and flip state when filter changes
  useEffect(() => {
    setCurrentIndex(0);
    setShowBack(false);
  }, [factionFilter]);

  // Ensure index stays in bounds when investigators list changes
  useEffect(() => {
    if (currentIndex >= filteredInvestigators.length && filteredInvestigators.length > 0) {
      setCurrentIndex(filteredInvestigators.length - 1);
    }
  }, [filteredInvestigators.length, currentIndex]);

  // Reset flip state when changing investigator
  useEffect(() => {
    setShowBack(false);
    setBackImageFailed(false);
    setFrontImageFailed(false);
    setIsLandscape(false);
  }, [currentIndex]);

  const currentInvestigator = filteredInvestigators[currentIndex];
  const factions: ArkhamFaction[] = ['guardian', 'seeker', 'rogue', 'mystic', 'survivor', 'neutral'];

  const goToPrevious = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : filteredInvestigators.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev < filteredInvestigators.length - 1 ? prev + 1 : 0));
  };

  const handleSelect = () => {
    if (currentInvestigator) {
      onSelect(currentInvestigator);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'Enter' && currentInvestigator) handleSelect();
      if ((e.key === 'f' || e.key === 'F') && !backImageFailed) {
        setIsLandscape(false);
        setShowBack(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentInvestigator, filteredInvestigators.length, backImageFailed]);

  if (filteredInvestigators.length === 0 || !currentInvestigator) {
    return (
      <div className="min-h-screen bg-cc-dark flex flex-col items-center justify-center p-4">
        <p className="text-gray-400 mb-2">No investigators found</p>
        <button
          onClick={() => setFactionFilter(null)}
          className="px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg"
        >
          Clear Filter
        </button>
      </div>
    );
  }

  const frontImageUrl = arkhamCardService.getArkhamCardImageUrl(currentInvestigator.code);
  const backImageUrl = arkhamCardService.getArkhamCardImageUrl(currentInvestigator.code + 'b');
  const imageUrl = (showBack && !backImageFailed) ? backImageUrl : frontImageUrl;

  // Determine if this is a special version
  const isParallel = /^90/.test(currentInvestigator.code);
  const isPromo = /^9[89]/.test(currentInvestigator.code);
  const versionLabel = isParallel ? 'Parallel' : isPromo ? 'Promo' : null;

  return (
    <div className="min-h-screen bg-cc-dark flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-cc-darker border-b border-cc-border p-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <h1 className="text-lg font-bold text-white whitespace-nowrap">Choose Investigator</h1>

          {/* Faction filter dropdown */}
          <div className="relative flex-1 max-w-xs">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-cc-dark border border-cc-border rounded-lg text-white"
            >
              <span className="flex items-center gap-2">
                {factionFilter ? (
                  <>
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: FACTION_COLORS[factionFilter] }}
                    />
                    {FACTION_NAMES[factionFilter]}
                  </>
                ) : (
                  'All Factions'
                )}
              </span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-cc-darker border border-cc-border rounded-lg overflow-hidden z-20">
                <button
                  onClick={() => { setFactionFilter(null); setIsDropdownOpen(false); }}
                  className={`w-full px-3 py-2 text-left hover:bg-cc-dark ${!factionFilter ? 'bg-gold-600/20 text-gold-400' : 'text-white'}`}
                >
                  All Factions
                </button>
                {factions.map(faction => (
                  <button
                    key={faction}
                    onClick={() => { setFactionFilter(faction); setIsDropdownOpen(false); }}
                    className={`w-full px-3 py-2 text-left hover:bg-cc-dark flex items-center gap-2 ${factionFilter === faction ? 'text-white' : 'text-gray-300'}`}
                    style={{ backgroundColor: factionFilter === faction ? FACTION_COLORS[faction] + '20' : undefined }}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: FACTION_COLORS[faction] }}
                    />
                    {FACTION_NAMES[faction]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Investigator dropdown */}
          <div className="relative flex-1 max-w-sm">
            <select
              value={currentIndex}
              onChange={(e) => setCurrentIndex(Number(e.target.value))}
              className="w-full px-3 py-2 bg-cc-dark border border-cc-border rounded-lg text-white appearance-none cursor-pointer pr-8"
            >
              {filteredInvestigators.map((inv, idx) => {
                const invIsParallel = /^90/.test(inv.code);
                const invIsPromo = /^9[89]/.test(inv.code);
                const invLabel = invIsParallel ? ' (Parallel)' : invIsPromo ? ' (Promo)' : '';
                return (
                  <option key={inv.code} value={idx}>
                    {inv.name}{invLabel}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2">
            {onImport && (
              <button
                onClick={onImport}
                className="flex items-center gap-2 px-3 py-2 bg-cc-dark hover:bg-cc-border border border-cc-border text-white font-medium rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Import</span>
              </button>
            )}
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main carousel area */}
      <div className="flex-1 flex items-center justify-center p-4 gap-4">
        {/* Previous button */}
        <button
          onClick={goToPrevious}
          className="flex-shrink-0 p-3 bg-cc-darker hover:bg-cc-dark border border-cc-border rounded-full text-white transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Card display */}
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {/* Card image container */}
          <div
            className="flex items-center justify-center"
            style={{
              width: 'min(90vw, 900px)',
              height: !isLandscape ? 'min(63vw, 630px)' : 'auto',
              minHeight: '300px'
            }}
          >
            {frontImageFailed && !showBack ? (
              <div className="flex flex-col items-center justify-center text-gray-400 p-8 bg-cc-darker rounded-lg" style={{ width: 'min(90vw, 900px)', height: '400px' }}>
                <p className="text-lg mb-2">Image not available</p>
                <p className="text-sm text-gray-400">{currentInvestigator.name}</p>
                <p className="text-xs text-gray-500 mt-2">Code: {currentInvestigator.code}</p>
              </div>
            ) : (
              <img
                key={`${currentInvestigator.code}-${showBack ? 'back' : 'front'}`}
                src={imageUrl}
                alt={`${currentInvestigator.name} ${showBack && !backImageFailed ? '(back)' : '(front)'}`}
                className="rounded-lg shadow-2xl"
                style={!isLandscape ? {
                  transform: 'rotate(90deg)',
                  height: 'min(90vw, 900px)',
                  width: 'auto'
                } : {
                  width: 'min(90vw, 900px)',
                  height: 'auto'
                }}
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  setIsLandscape(img.naturalWidth > img.naturalHeight);
                }}
                onError={() => {
                  if (showBack && !backImageFailed) {
                    setBackImageFailed(true);
                    setShowBack(false);
                  } else if (!showBack) {
                    setFrontImageFailed(true);
                  }
                }}
              />
            )}
          </div>

          {/* Controls below card - always in same position */}
          <div className="mt-4 flex items-center justify-center gap-6 text-gray-400 text-sm">
            <span className="px-2 py-1 bg-cc-darker rounded text-white text-sm font-medium">
              {backImageFailed ? 'No back available' : (showBack ? 'Back' : 'Front')}
            </span>

            <span>{currentIndex + 1} of {filteredInvestigators.length}</span>

            {!backImageFailed && (
              <button
                onClick={() => {
                  setIsLandscape(false);
                  setShowBack(!showBack);
                }}
                className="flex items-center gap-2 px-3 py-1 bg-cc-darker hover:bg-cc-dark rounded text-white transition-colors"
                title="Flip card (F)"
              >
                <RotateCw className="w-4 h-4" />
                <span>Flip (F)</span>
              </button>
            )}
          </div>
        </div>

        {/* Next button */}
        <button
          onClick={goToNext}
          className="flex-shrink-0 p-3 bg-cc-darker hover:bg-cc-dark border border-cc-border rounded-full text-white transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom bar with info and select button */}
      <div className="flex-shrink-0 bg-cc-darker border-t border-cc-border p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-xl font-bold text-white truncate">{currentInvestigator.name}</h2>
              <span
                className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0"
                style={{
                  backgroundColor: FACTION_COLORS[currentInvestigator.faction_code] + '40',
                  color: FACTION_COLORS[currentInvestigator.faction_code]
                }}
              >
                {FACTION_NAMES[currentInvestigator.faction_code]}
              </span>
              {versionLabel && (
                <span className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 bg-purple-600/40 text-purple-300">
                  {versionLabel}
                </span>
              )}
            </div>
            {currentInvestigator.subname && (
              <p className="text-gray-400 text-sm truncate">{currentInvestigator.subname}</p>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="text-white font-bold">{currentInvestigator.skill_willpower}</span>
                  <SingleSkillIcon type="willpower" />
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-white font-bold">{currentInvestigator.skill_intellect}</span>
                  <SingleSkillIcon type="intellect" />
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-white font-bold">{currentInvestigator.skill_combat}</span>
                  <SingleSkillIcon type="combat" />
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-white font-bold">{currentInvestigator.skill_agility}</span>
                  <SingleSkillIcon type="agility" />
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-600/80 text-white rounded font-medium">
                  <span className="font-bold">{currentInvestigator.health}</span>
                  <span className="text-red-200 text-xs">HP</span>
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-600/80 text-white rounded font-medium">
                  <span className="font-bold">{currentInvestigator.sanity}</span>
                  <span className="text-blue-200 text-xs">SAN</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSelect}
            className="flex-shrink-0 px-6 py-3 bg-gold-600 hover:bg-gold-500 text-black font-bold rounded-lg transition-colors text-lg"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}

