import type { Card } from '../types/card';
import type { GameConfig, ExportFormat } from '../config/gameConfig';
import { getActiveGameConfig } from '../context/GameContext';

/**
 * Export a deck using the specified format
 * @param cards Cards to export
 * @param formatId Export format ID from game config
 * @param gameConfig Optional game config (uses active config if not provided)
 * @returns Object with content string and suggested filename
 */
export function exportDeck(
  cards: Card[],
  formatId: string,
  gameConfig?: GameConfig
): { content: string; filename: string } {
  const config = gameConfig || getActiveGameConfig();

  const format = config.exportFormats.find(f => f.id === formatId);
  if (!format) {
    throw new Error(`Unknown export format: ${formatId}. Available formats: ${config.exportFormats.map(f => f.id).join(', ')}`);
  }

  const content = format.generate(cards, config.deckZones);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `draft-deck-${timestamp}${format.extension}`;

  return { content, filename };
}

/**
 * Download a file with the given content
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Export and download a deck
 * @param cards Cards to export
 * @param formatId Export format ID
 * @param gameConfig Optional game config
 */
export function exportAndDownload(
  cards: Card[],
  formatId: string,
  gameConfig?: GameConfig
): void {
  const { content, filename } = exportDeck(cards, formatId, gameConfig);
  downloadFile(content, filename);
}

/**
 * Get available export formats for the current game
 */
export function getExportFormats(gameConfig?: GameConfig): ExportFormat[] {
  const config = gameConfig || getActiveGameConfig();
  return config.exportFormats;
}

/**
 * Check if an export format is available
 */
export function hasExportFormat(formatId: string, gameConfig?: GameConfig): boolean {
  const config = gameConfig || getActiveGameConfig();
  return config.exportFormats.some(f => f.id === formatId);
}
