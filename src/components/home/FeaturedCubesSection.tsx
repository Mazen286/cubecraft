import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { cubeService, type CubeInfo } from '../../services/cubeService';
import { CubePreviewCard } from './CubePreviewCard';
import { cn } from '../../lib/utils';

interface FeaturedCubesSectionProps {
  className?: string;
}

/**
 * Horizontal scrollable section displaying featured cubes with previews
 */
export function FeaturedCubesSection({ className }: FeaturedCubesSectionProps) {
  const [cubes, setCubes] = useState<CubeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load available cubes on mount
  useEffect(() => {
    const loadCubes = async () => {
      try {
        // Get local cubes (pre-built featured cubes)
        const localCubes = cubeService.getAvailableCubes();
        setCubes(localCubes);
      } catch (error) {
        console.error('Failed to load cubes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCubes();
  }, []);

  if (isLoading) {
    return (
      <div className={cn("w-full px-4", className)}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 text-center">
            Featured Cubes
          </h2>
          <div className="flex justify-center">
            <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (cubes.length === 0) {
    return null;
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 text-center">
          Featured Cubes
        </h2>
        <p className="text-center text-gray-500 text-sm mb-6">
          <Link
            to="/my-cubes"
            className="inline-flex items-center gap-1 text-gray-400 hover:text-gold-400 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload your own cube
          </Link>
        </p>
      </div>

      {/* Horizontal scroll container */}
      <div className="overflow-x-auto pb-4 scrollbar-thin">
        {/* Scrollable content - always scrollable, centered with auto margins */}
        <div
          className="flex gap-4 px-4 sm:px-8 w-max mx-auto"
        >
          {cubes.map((cube) => (
            <CubePreviewCard key={cube.id} cube={cube} />
          ))}
        </div>
      </div>
    </div>
  );
}
