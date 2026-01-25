import React, { useState, useRef } from 'react';
import { useGameConfig } from '../../context/GameContext';
import { parseUploadedFile, validateCube, cubeToCardMap, type ParsedCube } from '../../services/cubeUploadService';
import { cubeService } from '../../services/cubeService';
import { getAllGameConfigs } from '../../config/games';

interface CubeUploadProps {
  onUploadComplete?: (cubeId: string) => void;
  onCancel?: () => void;
}

export function CubeUpload({ onUploadComplete, onCancel }: CubeUploadProps) {
  const { gameConfig } = useGameConfig();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'select' | 'preview' | 'saving'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedCube, setParsedCube] = useState<ParsedCube | null>(null);
  const [selectedGameId, setSelectedGameId] = useState(gameConfig.id);
  const [cubeName, setCubeName] = useState('');
  const [cubeDescription, setCubeDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);

    try {
      const parsed = await parseUploadedFile(file, selectedGameId);
      setParsedCube(parsed);
      setCubeName(parsed.name);
      setCubeDescription(parsed.description);

      // Validate
      const validation = validateCube(parsed);
      setValidationErrors(validation.errors);

      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  };

  const handleGameChange = async (newGameId: string) => {
    setSelectedGameId(newGameId);

    // Re-parse if we have a file
    if (selectedFile) {
      try {
        const parsed = await parseUploadedFile(selectedFile, newGameId);
        setParsedCube(parsed);

        const validation = validateCube(parsed);
        setValidationErrors(validation.errors);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file');
      }
    }
  };

  const handleSave = async () => {
    if (!parsedCube) return;

    setStep('saving');
    setError(null);

    try {
      const cardMap = cubeToCardMap(parsedCube.cards);

      const result = await cubeService.saveCubeToDatabase(
        cubeName,
        cubeDescription,
        selectedGameId,
        cardMap,
        { isPublic }
      );

      if (result.error) {
        setError(result.error);
        setStep('preview');
        return;
      }

      onUploadComplete?.(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cube');
      setStep('preview');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      // Simulate file input change
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  };

  return (
    <div className="bg-yugi-dark border border-yugi-border rounded-lg p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gold-400 mb-4">Upload Cube</h2>

      {step === 'select' && (
        <div className="space-y-4">
          {/* Game Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Game</label>
            <select
              value={selectedGameId}
              onChange={(e) => handleGameChange(e.target.value)}
              className="w-full bg-yugi-darker border border-yugi-border rounded px-3 py-2 text-white"
            >
              {getAllGameConfigs().map(config => (
                <option key={config.id} value={config.id}>{config.name}</option>
              ))}
            </select>
          </div>

          {/* Drop Zone */}
          <div
            className="border-2 border-dashed border-yugi-border rounded-lg p-8 text-center hover:border-gold-500 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="text-4xl mb-2">📁</div>
            <p className="text-gray-300 mb-1">
              Drag & drop a file or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Supports CSV and JSON formats
            </p>
          </div>

          {/* Format Help */}
          <div className="text-sm text-gray-500 space-y-2">
            <p className="font-medium text-gray-400">Supported formats:</p>
            <div className="bg-yugi-darker rounded p-3 font-mono text-xs">
              <p className="text-gray-400 mb-1">CSV (with header):</p>
              <p>name,type,description,score</p>
              <p>Blue-Eyes White Dragon,Dragon,A legendary dragon...,95</p>
            </div>
            <div className="bg-yugi-darker rounded p-3 font-mono text-xs">
              <p className="text-gray-400 mb-1">JSON (array):</p>
              <p>{'[{ "name": "...", "type": "...", "score": 85 }, ...]'}</p>
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-3">
              {error}
            </div>
          )}

          {onCancel && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {step === 'preview' && parsedCube && (
        <div className="space-y-4">
          {/* Cube Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cube Name</label>
              <input
                type="text"
                value={cubeName}
                onChange={(e) => setCubeName(e.target.value)}
                className="w-full bg-yugi-darker border border-yugi-border rounded px-3 py-2 text-white"
                placeholder="My Custom Cube"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Game</label>
              <select
                value={selectedGameId}
                onChange={(e) => handleGameChange(e.target.value)}
                className="w-full bg-yugi-darker border border-yugi-border rounded px-3 py-2 text-white"
              >
                {getAllGameConfigs().map(config => (
                  <option key={config.id} value={config.id}>{config.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={cubeDescription}
              onChange={(e) => setCubeDescription(e.target.value)}
              className="w-full bg-yugi-darker border border-yugi-border rounded px-3 py-2 text-white resize-none"
              rows={2}
              placeholder="Describe your cube..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded border-yugi-border"
            />
            <label htmlFor="isPublic" className="text-sm text-gray-300">
              Make this cube public (anyone can use it)
            </label>
          </div>

          {/* Stats */}
          <div className="bg-yugi-darker rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400">Cards Found</span>
              <span className={`font-bold ${parsedCube.cards.length >= 40 ? 'text-green-400' : 'text-yellow-400'}`}>
                {parsedCube.cards.length}
              </span>
            </div>

            {/* Sample Cards */}
            <div className="text-sm text-gray-400 mb-2">Sample cards:</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {parsedCube.cards.slice(0, 5).map((card, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-white truncate flex-1">{card.name}</span>
                  <span className="text-gray-500 ml-2">{card.type}</span>
                  {card.score !== undefined && (
                    <span className="text-gold-400 ml-2">{card.score}</span>
                  )}
                </div>
              ))}
              {parsedCube.cards.length > 5 && (
                <div className="text-gray-500 text-sm">
                  ...and {parsedCube.cards.length - 5} more
                </div>
              )}
            </div>
          </div>

          {/* Warnings */}
          {parsedCube.warnings.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-800 rounded p-3">
              <div className="text-yellow-400 text-sm font-medium mb-1">Warnings</div>
              <ul className="text-sm text-yellow-300 list-disc list-inside max-h-24 overflow-y-auto">
                {parsedCube.warnings.slice(0, 10).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {parsedCube.warnings.length > 10 && (
                  <li>...and {parsedCube.warnings.length - 10} more</li>
                )}
              </ul>
            </div>
          )}

          {/* Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-red-900/20 border border-red-800 rounded p-3">
              <div className="text-red-400 text-sm font-medium mb-1">Errors</div>
              <ul className="text-sm text-red-300 list-disc list-inside">
                {validationErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-3">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setStep('select');
                setSelectedFile(null);
                setParsedCube(null);
              }}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={validationErrors.length > 0 || !cubeName.trim()}
              className="flex-1 px-4 py-2 bg-gold-600 hover:bg-gold-500 disabled:bg-gray-700 disabled:text-gray-500 text-black font-medium rounded transition-colors"
            >
              Upload Cube
            </button>
          </div>
        </div>
      )}

      {step === 'saving' && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Saving cube...</p>
        </div>
      )}
    </div>
  );
}

export default CubeUpload;
