/**
 * Grid Navigation Utilities
 *
 * Provides 2D grid-aware navigation for canvas stacks.
 * Converts freeform positioned stacks into a logical grid structure
 * for intuitive arrow key navigation.
 */

import type { CanvasStack, CardSize, ZoneCanvas } from '../types';
import { STACK_DIMENSIONS } from '../types';

/**
 * Represents a stack's position in the logical grid
 */
export interface GridCell {
  stackId: string;
  row: number;
  col: number;
}

/**
 * Maps stack positions to a 2D grid structure
 */
export interface GridMap {
  /** Map from stackId to its grid position */
  cells: Map<string, GridCell>;
  /** 2D grid where grid[row][col] = stackId or null */
  grid: (string | null)[][];
  /** Total number of rows */
  rowCount: number;
  /** Total number of columns */
  colCount: number;
  /** Map from stackId to its zone ID */
  stackZones: Map<string, string>;
  /** Per-zone grids for zone-aware navigation */
  zoneGrids: Map<string, { grid: (string | null)[][]; rowCount: number }>;
}

/**
 * Navigation result with new stack and card index
 */
export interface NavigationResult {
  stackId: string;
  cardIndex: number;
}

/** Tolerance in pixels for considering stacks to be on the same row */
const ROW_TOLERANCE = 50;

/** Gap between stacks (used for column calculation) */
const STACK_GAP = 24;

/**
 * Build a grid map from freeform positioned stacks
 *
 * Algorithm:
 * 1. Calculate expected columns based on container width
 * 2. Assign each stack to nearest column based on x-position
 * 3. Group stacks by y-position into rows (with tolerance)
 * 4. Build 2D lookup grid[row][col]
 */
export function buildGridMap(
  zones: ZoneCanvas[],
  cardSize: CardSize,
  containerWidth: number
): GridMap {
  const stackWidth = STACK_DIMENSIONS[cardSize].width;
  const columnWidth = stackWidth + STACK_GAP;
  const colCount = Math.max(1, Math.floor(containerWidth / columnWidth));

  // Track which zone each stack belongs to
  const stackZones = new Map<string, string>();
  const zoneGrids = new Map<string, { grid: (string | null)[][]; rowCount: number }>();

  // Build per-zone grids
  for (const zone of zones) {
    if (zone.collapsed || zone.stacks.length === 0) continue;

    // Track stack -> zone mapping
    for (const stack of zone.stacks) {
      stackZones.set(stack.id, zone.zoneId);
    }

    // Assign each stack to a column based on x-position
    const stacksWithColumns = zone.stacks.map(stack => ({
      stack,
      col: Math.min(
        colCount - 1,
        Math.max(0, Math.round(stack.position.x / columnWidth))
      ),
      y: stack.position.y,
    }));

    // Sort by y-position to group into rows
    stacksWithColumns.sort((a, b) => a.y - b.y);

    // Group into rows based on y-position with tolerance
    const rows: typeof stacksWithColumns[] = [];
    let currentRow: typeof stacksWithColumns = [];
    let currentRowY = -Infinity;

    for (const item of stacksWithColumns) {
      if (currentRow.length === 0 || Math.abs(item.y - currentRowY) <= ROW_TOLERANCE) {
        if (currentRow.length === 0) {
          currentRowY = item.y;
        }
        currentRow.push(item);
      } else {
        rows.push(currentRow);
        currentRow = [item];
        currentRowY = item.y;
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    // Build zone grid
    const zoneGrid: (string | null)[][] = [];
    for (const row of rows) {
      const gridRow: (string | null)[] = new Array(colCount).fill(null);
      row.sort((a, b) => a.col - b.col);

      for (const item of row) {
        let col = item.col;
        while (col < colCount && gridRow[col] !== null) {
          col++;
        }
        if (col >= colCount) {
          col = item.col - 1;
          while (col >= 0 && gridRow[col] !== null) {
            col--;
          }
        }
        if (col >= 0 && col < colCount) {
          gridRow[col] = item.stack.id;
        }
      }
      zoneGrid.push(gridRow);
    }

    zoneGrids.set(zone.zoneId, { grid: zoneGrid, rowCount: rows.length });
  }

  // Also build the combined grid (for backwards compatibility and cross-zone navigation)
  const allStacks: { stack: CanvasStack; zoneId: string }[] = [];
  for (const zone of zones) {
    if (zone.collapsed) continue;
    for (const stack of zone.stacks) {
      allStacks.push({ stack, zoneId: zone.zoneId });
    }
  }

  if (allStacks.length === 0) {
    return {
      cells: new Map(),
      grid: [],
      rowCount: 0,
      colCount,
      stackZones,
      zoneGrids,
    };
  }

  const stacksWithColumns = allStacks.map(({ stack }) => ({
    stack,
    col: Math.min(
      colCount - 1,
      Math.max(0, Math.round(stack.position.x / columnWidth))
    ),
    y: stack.position.y,
  }));

  stacksWithColumns.sort((a, b) => a.y - b.y);

  const rows: typeof stacksWithColumns[] = [];
  let currentRow: typeof stacksWithColumns = [];
  let currentRowY = -Infinity;

  for (const item of stacksWithColumns) {
    if (currentRow.length === 0 || Math.abs(item.y - currentRowY) <= ROW_TOLERANCE) {
      if (currentRow.length === 0) {
        currentRowY = item.y;
      }
      currentRow.push(item);
    } else {
      rows.push(currentRow);
      currentRow = [item];
      currentRowY = item.y;
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  const cells = new Map<string, GridCell>();
  const grid: (string | null)[][] = [];

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const gridRow: (string | null)[] = new Array(colCount).fill(null);
    row.sort((a, b) => a.col - b.col);

    for (const item of row) {
      let col = item.col;
      while (col < colCount && gridRow[col] !== null) {
        col++;
      }
      if (col >= colCount) {
        col = item.col - 1;
        while (col >= 0 && gridRow[col] !== null) {
          col--;
        }
      }
      if (col < 0 || col >= colCount) continue;

      gridRow[col] = item.stack.id;
      cells.set(item.stack.id, {
        stackId: item.stack.id,
        row: rowIdx,
        col,
      });
    }

    grid.push(gridRow);
  }

  return {
    cells,
    grid,
    rowCount: rows.length,
    colCount,
    stackZones,
    zoneGrids,
  };
}

/**
 * Find the stack to the left in the same row (zone-aware)
 * Returns null if at the leftmost position or no stack exists to the left
 */
export function findStackLeft(gridMap: GridMap, currentStackId: string): string | null {
  const cell = gridMap.cells.get(currentStackId);
  if (!cell) return null;

  // Get the zone for this stack to ensure we stay within it
  const zoneId = gridMap.stackZones.get(currentStackId);
  const zoneGrid = zoneId ? gridMap.zoneGrids.get(zoneId) : null;

  if (zoneGrid) {
    // Find current row in zone grid
    let zoneRow = -1;
    for (let r = 0; r < zoneGrid.rowCount; r++) {
      if (zoneGrid.grid[r]?.includes(currentStackId)) {
        zoneRow = r;
        break;
      }
    }

    if (zoneRow >= 0) {
      // Find current column in zone row
      const currentCol = zoneGrid.grid[zoneRow]?.indexOf(currentStackId) ?? -1;
      if (currentCol > 0) {
        // Search for the nearest occupied cell to the left within zone
        for (let c = currentCol - 1; c >= 0; c--) {
          const stackId = zoneGrid.grid[zoneRow]?.[c];
          if (stackId) return stackId;
        }
      }
    }
  }

  return null; // At edge or no zone grid, stay put
}

/**
 * Find the stack to the right in the same row (zone-aware)
 * Returns null if at the rightmost position or no stack exists to the right
 */
export function findStackRight(gridMap: GridMap, currentStackId: string): string | null {
  const cell = gridMap.cells.get(currentStackId);
  if (!cell) return null;

  // Get the zone for this stack to ensure we stay within it
  const zoneId = gridMap.stackZones.get(currentStackId);
  const zoneGrid = zoneId ? gridMap.zoneGrids.get(zoneId) : null;

  if (zoneGrid) {
    // Find current row in zone grid
    let zoneRow = -1;
    for (let r = 0; r < zoneGrid.rowCount; r++) {
      if (zoneGrid.grid[r]?.includes(currentStackId)) {
        zoneRow = r;
        break;
      }
    }

    if (zoneRow >= 0) {
      // Find current column in zone row
      const currentCol = zoneGrid.grid[zoneRow]?.indexOf(currentStackId) ?? -1;
      const rowLength = zoneGrid.grid[zoneRow]?.length ?? 0;
      if (currentCol >= 0 && currentCol < rowLength - 1) {
        // Search for the nearest occupied cell to the right within zone
        for (let c = currentCol + 1; c < rowLength; c++) {
          const stackId = zoneGrid.grid[zoneRow]?.[c];
          if (stackId) return stackId;
        }
      }
    }
  }

  return null; // At edge or no zone grid, stay put
}

/**
 * Navigate up - either within a stack or to the stack above
 *
 * If not at the first card of current stack: move to previous card
 * If at first card: jump to LAST card of the stack above (same column, same zone first)
 */
export function navigateUp(
  gridMap: GridMap,
  stackId: string,
  cardIndex: number,
  getStack: (id: string) => CanvasStack | null,
  getVisibleCardCount?: (stack: CanvasStack) => number
): NavigationResult {
  const stack = getStack(stackId);
  if (!stack) return { stackId, cardIndex };

  // If not at first card, move up within stack
  if (cardIndex > 0) {
    return { stackId, cardIndex: cardIndex - 1 };
  }

  // At first card - try to jump to stack above (same zone first)
  const cell = gridMap.cells.get(stackId);
  if (!cell) return { stackId, cardIndex: 0 };

  // Get the zone for this stack
  const zoneId = gridMap.stackZones.get(stackId);
  const zoneGrid = zoneId ? gridMap.zoneGrids.get(zoneId) : null;

  // Helper to find last card index
  const getLastIndex = (targetStackId: string) => {
    const targetStack = getStack(targetStackId);
    if (!targetStack) return 0;
    const cardCount = getVisibleCardCount ? getVisibleCardCount(targetStack) : targetStack.cardIds.length;
    return Math.max(0, cardCount - 1);
  };

  // First, try to find a stack above in the SAME zone
  if (zoneGrid) {
    // Find current row in zone grid
    let zoneRow = -1;
    for (let r = 0; r < zoneGrid.rowCount; r++) {
      if (zoneGrid.grid[r]?.includes(stackId)) {
        zoneRow = r;
        break;
      }
    }

    if (zoneRow > 0) {
      // Search for stack above in same zone, same column
      for (let r = zoneRow - 1; r >= 0; r--) {
        const aboveStackId = zoneGrid.grid[r]?.[cell.col];
        if (aboveStackId) {
          return { stackId: aboveStackId, cardIndex: getLastIndex(aboveStackId) };
        }
      }
    }
  }

  // No stack above in same zone - stay at current position (don't jump zones)
  return { stackId, cardIndex: 0 };
}

/**
 * Navigate down - either within a stack or to the stack below
 *
 * If not at the last card of current stack: move to next card
 * If at last card: jump to FIRST card of the stack below (same column, same zone first)
 */
export function navigateDown(
  gridMap: GridMap,
  stackId: string,
  cardIndex: number,
  getStack: (id: string) => CanvasStack | null,
  getVisibleCardCount?: (stack: CanvasStack) => number
): NavigationResult {
  const stack = getStack(stackId);
  if (!stack) return { stackId, cardIndex };

  // Use visible count if available (filters/sorts may hide some cards)
  const cardCount = getVisibleCardCount ? getVisibleCardCount(stack) : stack.cardIds.length;
  const lastIndex = Math.max(0, cardCount - 1);

  // If not at last card, move down within stack
  if (cardIndex < lastIndex) {
    return { stackId, cardIndex: cardIndex + 1 };
  }

  // At last card - try to jump to stack below (same zone first)
  const cell = gridMap.cells.get(stackId);
  if (!cell) return { stackId, cardIndex: lastIndex };

  // Get the zone for this stack
  const zoneId = gridMap.stackZones.get(stackId);
  const zoneGrid = zoneId ? gridMap.zoneGrids.get(zoneId) : null;

  // First, try to find a stack below in the SAME zone
  if (zoneGrid) {
    // Find current row in zone grid
    let zoneRow = -1;
    for (let r = 0; r < zoneGrid.rowCount; r++) {
      if (zoneGrid.grid[r]?.includes(stackId)) {
        zoneRow = r;
        break;
      }
    }

    if (zoneRow >= 0 && zoneRow < zoneGrid.rowCount - 1) {
      // Search for stack below in same zone, same column
      for (let r = zoneRow + 1; r < zoneGrid.rowCount; r++) {
        const belowStackId = zoneGrid.grid[r]?.[cell.col];
        if (belowStackId) {
          return { stackId: belowStackId, cardIndex: 0 };
        }
      }
    }
  }

  // No stack below in same zone - stay at current position (don't jump zones)
  return { stackId, cardIndex: lastIndex };
}

/**
 * Get the first stack in the grid (for initial focus)
 */
export function getFirstStack(gridMap: GridMap): string | null {
  for (let r = 0; r < gridMap.rowCount; r++) {
    for (let c = 0; c < gridMap.colCount; c++) {
      const stackId = gridMap.grid[r]?.[c];
      if (stackId) return stackId;
    }
  }
  return null;
}
