import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Trash2, MoveRight, ChevronDown } from 'lucide-react';
import { useDeckBuilder, type DeckCard } from '../../context/DeckBuilderContext';
import { useGameConfig } from '../../context/GameContext';
import { CardDetailSheet } from '../cards/CardDetailSheet';
import type { YuGiOhCard } from '../../types';

interface DeckZonePanelProps {
  zoneId: string;
  className?: string;
}

export function DeckZonePanel({ zoneId, className = '' }: DeckZonePanelProps) {
  const { getZoneCards, removeCard, moveCard, getZoneConfig, getAvailableZones } = useDeckBuilder();
  const { gameConfig } = useGameConfig();
  const gridRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [showMoveMenu, setShowMoveMenu] = useState<string | null>(null);

  const zoneConfig = getZoneConfig(zoneId);
  const cards = getZoneCards(zoneId);
  const otherZones = getAvailableZones().filter(z => z.id !== zoneId);

  // Measure container width
  useEffect(() => {
    if (!gridRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, []);

  // Calculate grid dimensions
  const cardWidth = containerWidth < 400 ? 70 : 90;
  const cardHeight = Math.round(cardWidth * 1.4);
  const gap = 6;
  const columns = Math.max(1, Math.floor((containerWidth - 16 + gap) / (cardWidth + gap)));

  const rows = useMemo(() => {
    const result: DeckCard[][] = [];
    for (let i = 0; i < cards.length; i += columns) {
      result.push(cards.slice(i, i + columns));
    }
    return result;
  }, [cards, columns]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => gridRef.current,
    estimateSize: () => cardHeight + gap,
    overscan: 3,
  });

  const handleCardClick = useCallback((card: DeckCard) => {
    setSelectedCard(card);
  }, []);

  const handleRemoveCard = useCallback((instanceId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    removeCard(instanceId);
  }, [removeCard]);

  const handleMoveCard = useCallback((instanceId: string, targetZoneId: string) => {
    moveCard(instanceId, targetZoneId);
    setShowMoveMenu(null);
  }, [moveCard]);

  const handleDragStart = useCallback((e: React.DragEvent, card: DeckCard) => {
    e.dataTransfer.setData('application/json', JSON.stringify(card));
    e.dataTransfer.setData('text/plain', card.instanceId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const instanceId = e.dataTransfer.getData('text/plain');
    if (instanceId) {
      moveCard(instanceId, zoneId);
    }
  }, [moveCard, zoneId]);

  // Zone count display
  const countDisplay = useMemo(() => {
    const count = cards.length;
    if (zoneConfig?.exactCards) {
      return `${count}/${zoneConfig.exactCards}`;
    }
    if (zoneConfig?.maxCards) {
      return `${count}/${zoneConfig.maxCards}`;
    }
    if (zoneConfig?.minCards) {
      return `${count} (min ${zoneConfig.minCards})`;
    }
    return String(count);
  }, [cards.length, zoneConfig]);

  const countColor = useMemo(() => {
    const count = cards.length;
    if (zoneConfig?.exactCards) {
      return count === zoneConfig.exactCards ? 'text-green-400' : 'text-yellow-400';
    }
    if (zoneConfig?.maxCards && count > zoneConfig.maxCards) {
      return 'text-red-400';
    }
    if (zoneConfig?.minCards && count < zoneConfig.minCards && !zoneConfig.isOptional) {
      return 'text-yellow-400';
    }
    return 'text-gray-400';
  }, [cards.length, zoneConfig]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Zone Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-yugi-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {zoneConfig?.name || zoneId}
          </h3>
          <span className={`text-sm font-medium ${countColor}`}>
            {countDisplay}
          </span>
        </div>
        {zoneConfig?.copyLimit && (
          <p className="text-xs text-gray-500 mt-1">
            Max {zoneConfig.copyLimit} copies per card
          </p>
        )}
      </div>

      {/* Cards Grid */}
      <div
        ref={gridRef}
        className="flex-1 overflow-y-auto p-3"
        style={{ contain: 'strict' }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {cards.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-gray-500 mb-2">No cards in {zoneConfig?.name || zoneId}</p>
              <p className="text-xs text-gray-600">
                Add cards from the browser or drag from other zones
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const rowCards = rows[virtualRow.index];
              return (
                <div
                  key={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    className="flex gap-1.5"
                    style={{ height: cardHeight }}
                  >
                    {rowCards.map((card) => {
                      const imageUrl = card.imageUrl || gameConfig.getCardImageUrl(
                        { ...card, attributes: card.attributes || {} },
                        'sm'
                      );

                      return (
                        <div
                          key={card.instanceId}
                          draggable
                          onDragStart={(e) => handleDragStart(e, card)}
                          className="relative group cursor-pointer rounded overflow-hidden hover:ring-2 hover:ring-gold-500 transition-all"
                          style={{ width: cardWidth, height: cardHeight }}
                          onClick={() => handleCardClick(card)}
                        >
                          <img
                            src={imageUrl}
                            alt={card.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            draggable={false}
                          />

                          {/* Hover overlay with actions */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            {/* Move button (only if other zones exist) */}
                            {otherZones.length > 0 && (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMoveMenu(showMoveMenu === card.instanceId ? null : card.instanceId);
                                  }}
                                  className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
                                  title="Move to another zone"
                                >
                                  <MoveRight className="w-3.5 h-3.5" />
                                </button>

                                {/* Move dropdown menu */}
                                {showMoveMenu === card.instanceId && (
                                  <div className="absolute top-full left-0 mt-1 bg-yugi-darker border border-yugi-border rounded shadow-lg z-20 min-w-[100px]">
                                    {otherZones.map(zone => (
                                      <button
                                        key={zone.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveCard(card.instanceId, zone.id);
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-yugi-border hover:text-white transition-colors"
                                      >
                                        {zone.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Remove button */}
                            <button
                              onClick={(e) => handleRemoveCard(card.instanceId, e)}
                              className="p-1.5 bg-red-600 hover:bg-red-500 rounded text-white transition-colors"
                              title="Remove from deck"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card Detail Sheet */}
      <CardDetailSheet
        card={selectedCard as unknown as YuGiOhCard | null}
        isOpen={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        hideScores
        footer={selectedCard && (() => (
          <div className="p-4 border-t border-yugi-border bg-yugi-darker">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">
                In {zoneConfig?.name || zoneId}
              </span>
              <div className="flex items-center gap-2">
                {/* Move dropdown */}
                {otherZones.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowMoveMenu(showMoveMenu === 'sheet' ? null : 'sheet')}
                      className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                    >
                      <MoveRight className="w-4 h-4" />
                      Move
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {showMoveMenu === 'sheet' && (
                      <div className="absolute bottom-full right-0 mb-1 bg-yugi-darker border border-yugi-border rounded shadow-lg z-20 min-w-[120px]">
                        {otherZones.map(zone => (
                          <button
                            key={zone.id}
                            onClick={() => {
                              handleMoveCard(selectedCard.instanceId, zone.id);
                              setSelectedCard(null);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-yugi-border hover:text-white transition-colors"
                          >
                            {zone.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Remove button */}
                <button
                  onClick={() => {
                    handleRemoveCard(selectedCard.instanceId);
                    setSelectedCard(null);
                  }}
                  className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))()}
      />
    </div>
  );
}
