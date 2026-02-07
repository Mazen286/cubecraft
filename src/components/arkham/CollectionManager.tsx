/**
 * Collection Manager Modal - lets users track which packs they own
 */

import { useState, useMemo, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import { arkhamCardService } from '../../services/arkhamCardService';
import { collectionService } from '../../services/collectionService';
import type { ArkhamPack } from '../../types/arkham';

interface CollectionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export function CollectionManager({ isOpen, onClose, onChanged }: CollectionManagerProps) {
  const [ownedPacks, setOwnedPacks] = useState<Set<string>>(new Set());

  // Load on open
  useEffect(() => {
    if (isOpen) {
      setOwnedPacks(collectionService.getOwnedPacks());
    }
  }, [isOpen]);

  // Packs grouped by cycle
  const packsByCycle = useMemo(() => {
    const packs = arkhamCardService.getPacks();
    const cycles = new Map<string, { name: string; position: number; packs: ArkhamPack[] }>();
    for (const pack of packs) {
      const key = pack.cycle_code || 'standalone';
      const name = pack.cycle_name || 'Standalone';
      if (!cycles.has(key)) cycles.set(key, { name, position: pack.cycle_position, packs: [] });
      cycles.get(key)!.packs.push(pack);
    }
    for (const cycle of cycles.values()) {
      cycle.packs.sort((a, b) => a.position - b.position);
    }
    // Sort cycles by position
    return [...cycles.entries()].sort((a, b) => a[1].position - b[1].position);
  }, []);

  const allPackCodes = useMemo(() => {
    return arkhamCardService.getPacks().map(p => p.code);
  }, []);

  const totalPacks = allPackCodes.length;
  const ownedCount = ownedPacks.size;

  const toggle = (code: string) => {
    const next = new Set(ownedPacks);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setOwnedPacks(next);
    collectionService.setOwnedPacks([...next]);
    onChanged?.();
  };

  const toggleCycle = (packs: ArkhamPack[], allOwned: boolean) => {
    const next = new Set(ownedPacks);
    for (const p of packs) {
      if (allOwned) {
        next.delete(p.code);
      } else {
        next.add(p.code);
      }
    }
    setOwnedPacks(next);
    collectionService.setOwnedPacks([...next]);
    onChanged?.();
  };

  const handleOwnAll = () => {
    const next = new Set(allPackCodes);
    setOwnedPacks(next);
    collectionService.ownAll(allPackCodes);
    onChanged?.();
  };

  const handleOwnNone = () => {
    setOwnedPacks(new Set());
    collectionService.ownNone();
    onChanged?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-cc-card border border-cc-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cc-border">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-gold-400" />
            <h3 className="text-lg font-semibold text-white">
              My Collection ({ownedCount}/{totalPacks} packs)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Own All / Own None */}
        <div className="flex gap-2 px-4 py-2 border-b border-cc-border">
          <button
            onClick={handleOwnAll}
            className="px-3 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded transition-colors"
          >
            Own All
          </button>
          <button
            onClick={handleOwnNone}
            className="px-3 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors"
          >
            Own None
          </button>
        </div>

        {/* Pack list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {packsByCycle.map(([cycleCode, { name: cycleName, packs }]) => {
            const allOwned = packs.every(p => ownedPacks.has(p.code));
            const someOwned = packs.some(p => ownedPacks.has(p.code));

            return (
              <div key={cycleCode}>
                {/* Cycle header */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-300 uppercase tracking-wide">
                    {cycleName}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleCycle(packs, false)}
                      className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                        allOwned
                          ? 'text-green-400 bg-green-600/20'
                          : 'text-gray-500 hover:text-gold-400'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => toggleCycle(packs, true)}
                      className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                        !someOwned
                          ? 'text-gray-600'
                          : 'text-gray-500 hover:text-gold-400'
                      }`}
                    >
                      None
                    </button>
                  </div>
                </div>

                {/* Pack checkboxes */}
                <div className="space-y-0.5">
                  {packs.map(pack => {
                    const isOwned = ownedPacks.has(pack.code);
                    return (
                      <label
                        key={pack.code}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-cc-darker cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isOwned}
                          onChange={() => toggle(pack.code)}
                          className="w-4 h-4 rounded border-gray-600 bg-cc-darker text-gold-500 focus:ring-gold-500/50 cursor-pointer"
                        />
                        <span className={`text-sm ${isOwned ? 'text-white' : 'text-gray-400'}`}>
                          {pack.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
