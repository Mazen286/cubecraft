import { useState, useRef } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle, RefreshCw, Loader2, Link } from 'lucide-react';
import { useArkhamDeckBuilder } from '../../context/ArkhamDeckBuilderContext';
import { parseArkhamDeckFile } from '../../services/arkhamDeckImport';
import { arkhamCardService } from '../../services/arkhamCardService';

interface ImportDeckModalProps {
  isOpen: boolean;
  onClose: (imported?: boolean) => void;
}

export function ImportDeckModal({ isOpen, onClose }: ImportDeckModalProps) {
  const { importDeck } = useArkhamDeckBuilder();
  const [textContent, setTextContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    warnings: string[];
    errors: string[];
    type?: 'import' | 'refresh';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleRefreshDatabase = async () => {
    setIsRefreshing(true);
    setResult(null);
    try {
      await arkhamCardService.refreshCache();
      setResult({
        success: true,
        warnings: [],
        errors: [],
        type: 'refresh',
      });
      // Show success briefly then clear
      setTimeout(() => setResult(null), 2000);
    } catch (error) {
      setResult({
        success: false,
        warnings: [],
        errors: [error instanceof Error ? error.message : 'Failed to refresh database'],
        type: 'refresh',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleImportUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setResult({ success: false, warnings: [], errors: ['Please enter a URL'], type: 'import' });
      return;
    }

    // Parse ArkhamDB URL to extract ID and type (decklist vs deck)
    let deckId: string | null = null;
    let isDeckList = true;

    const patterns = [
      // Published decklist: /decklist/view/{id}
      /arkhamdb\.com\/decklist\/(?:view|edit)\/(\d+)/,
      // Private deck: /deck/view/{id}
      /arkhamdb\.com\/deck\/(?:view|edit)\/(\d+)/,
    ];

    // Check if input is just a numeric ID
    if (/^\d+$/.test(trimmed)) {
      deckId = trimmed;
      isDeckList = true; // Default to published decklist
    } else {
      for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) {
          deckId = match[1];
          isDeckList = pattern.source.includes('decklist');
          break;
        }
      }
    }

    if (!deckId) {
      setResult({
        success: false,
        warnings: [],
        errors: ['Could not parse ArkhamDB URL. Enter a full URL or just the numeric deck ID.'],
        type: 'import',
      });
      return;
    }

    setIsUrlLoading(true);
    setResult(null);

    try {
      const endpoint = isDeckList
        ? `https://arkhamdb.com/api/public/decklist/${deckId}`
        : `https://arkhamdb.com/api/public/deck/${deckId}`;

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`ArkhamDB returned ${response.status}. The deck may be private or not found.`);
      }

      const data = await response.json();
      if (!data.investigator_code || !data.slots) {
        throw new Error('Invalid deck data received from ArkhamDB');
      }

      // Convert to import text format: investigator + slot entries
      const lines: string[] = [`1x ${data.investigator_code}`];
      for (const [code, qty] of Object.entries(data.slots as Record<string, number>)) {
        lines.push(`${qty}x ${code}`);
      }
      const importText = lines.join('\n');

      const importResult = importDeck(importText);
      setResult({
        success: importResult.success,
        warnings: importResult.warnings,
        errors: importResult.errors,
        type: 'import',
      });

      if (importResult.success) {
        setTimeout(() => {
          onClose(true);
          setUrlInput('');
          setTextContent('');
          setResult(null);
        }, 1500);
      }
    } catch (error) {
      setResult({
        success: false,
        warnings: [],
        errors: [error instanceof Error ? error.message : 'Failed to fetch deck from ArkhamDB'],
        type: 'import',
      });
    } finally {
      setIsUrlLoading(false);
    }
  };

  const handleImportText = () => {
    if (!textContent.trim()) {
      setResult({ success: false, warnings: [], errors: ['Please paste deck content'], type: 'import' });
      return;
    }

    setIsProcessing(true);
    const importResult = importDeck(textContent);
    setResult({ ...importResult, type: 'import' });
    setIsProcessing(false);

    if (importResult.success) {
      setTimeout(() => {
        onClose(true); // Pass true to indicate successful import
        setTextContent('');
        setResult(null);
      }, 1500);
    }
  };

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    try {
      const parsed = await parseArkhamDeckFile(file);

      if (parsed.errors.length > 0) {
        setResult({ success: false, warnings: parsed.warnings, errors: parsed.errors, type: 'import' });
        setIsProcessing(false);
        return;
      }

      if (!parsed.investigatorCode) {
        setResult({
          success: false,
          warnings: parsed.warnings,
          errors: ['No investigator found in imported deck'],
          type: 'import',
        });
        setIsProcessing(false);
        return;
      }

      // Build import text from parsed file
      const importText = `1x ${parsed.investigatorCode}\n` +
        Object.entries(parsed.slots).map(([code, qty]) => `${qty}x ${code}`).join('\n');

      const importResult = importDeck(importText);

      setResult({
        success: importResult.success,
        warnings: [...parsed.warnings, ...importResult.warnings],
        errors: importResult.errors,
        type: 'import',
      });

      if (importResult.success) {
        setTimeout(() => {
          onClose(true); // Pass true to indicate successful import
          setTextContent('');
          setResult(null);
        }, 1500);
      }
    } catch (error) {
      setResult({
        success: false,
        warnings: [],
        errors: [error instanceof Error ? error.message : 'Failed to read file'],
        type: 'import',
      });
    }
    setIsProcessing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onClose()}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-cc-card border border-cc-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cc-border">
          <h2 className="text-lg font-semibold text-white">Import Deck</h2>
          <button
            onClick={() => onClose()}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-cc-border"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* File drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging
                ? 'border-gold-500 bg-gold-500/10'
                : 'border-cc-border hover:border-gray-500'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.o8d,.xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
            />
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-300 mb-2">
              Drop a file here or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-gold-400 hover:text-gold-300 underline"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-gray-500">
              Supports ArkhamDB text export (.txt) and OCTGN format (.o8d)
            </p>
          </div>

          {/* URL import */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Import from ArkhamDB URL</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleImportUrl(); }}
                placeholder="https://arkhamdb.com/decklist/view/12345 or just 12345"
                className="flex-1 px-3 py-2 bg-cc-darker border border-cc-border rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-gold-500/50"
              />
              <button
                onClick={handleImportUrl}
                disabled={!urlInput.trim() || isUrlLoading}
                className="px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUrlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isUrlLoading ? 'Loading...' : 'Import'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Paste an ArkhamDB URL or just the deck ID number</p>
          </div>

          {/* Refresh database option */}
          <div className="flex items-center justify-between p-3 bg-cc-darker rounded-lg">
            <div className="text-sm">
              <p className="text-gray-300">Card database outdated?</p>
              <p className="text-xs text-gray-500">
                Refresh to get latest cards from ArkhamDB
              </p>
            </div>
            <button
              onClick={handleRefreshDatabase}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-1.5 bg-cc-card hover:bg-cc-border border border-cc-border text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Or divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-cc-border" />
            <span className="text-gray-500 text-sm">or paste deck list</span>
            <div className="flex-1 border-t border-cc-border" />
          </div>

          {/* Text input */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Paste ArkhamDB export</span>
            </div>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder={`Paste deck list here...\n\nExample formats:\n1x Agnes Baker\n2x Shrivelling\n2x Ward of Protection (2)\n...`}
              className="w-full h-48 p-3 bg-cc-darker border border-cc-border rounded-lg text-white placeholder-gray-500 text-sm font-mono resize-none focus:outline-none focus:border-gold-500/50"
            />
          </div>

          {/* Result messages */}
          {result && (
            <div className="space-y-2">
              {result.success && result.warnings.length === 0 && result.errors.length === 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-900/30 border border-green-700 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span className="text-green-300">
                    {result.type === 'refresh' ? 'Database refreshed! Try importing again.' : 'Deck imported successfully!'}
                  </span>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <span className="text-red-300 font-medium">Errors</span>
                  </div>
                  <ul className="text-sm text-red-300 space-y-1">
                    {result.errors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.warnings.length > 0 && (
                <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <span className="text-yellow-300 font-medium">Warnings</span>
                  </div>
                  <ul className="text-sm text-yellow-300 space-y-1 max-h-32 overflow-y-auto">
                    {result.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-cc-border">
          <button
            onClick={() => onClose()}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImportText}
            disabled={!textContent.trim() || isProcessing}
            className="px-4 py-2 bg-gold-600 hover:bg-gold-500 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
