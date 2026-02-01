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
  // Collect all visible stacks from non-collapsed zones
  const allStacks: CanvasStack[] = [];
  for (const zone of zones) {
    if (zone.collapsed) continue;
    allStacks.push(...zone.stacks);
  }

  if (allStacks.length === 0) {
    return {
      cells: new Map(),
      grid: [],
      rowCount: 0,
      colCount: 0,
    };
  }

  const stackWidth = STACK_DIMENSIONS[cardSize].width;
  const columnWidth = stackWidth + STACK_GAP;

  // Calculate number of columns that fit in container
  const colCount = Math.max(1, Math.floor(containerWidth / columnWidth));

  // Assign each stack to a column based on x-position
  const stacksWithColumns = allStacks.map(stack => ({
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

  // Build the grid and cells map
  const cells = new Map<string, GridCell>();
  const grid: (string | null)[][] = [];

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const gridRow: (string | null)[] = new Array(colCount).fill(null);

    // Sort row items by column to handle conflicts
    row.sort((a, b) => a.col - b.col);

    for (const item of row) {
      // Find the first available column starting from the calculated one
      let col = item.col;
      while (col < colCount && gridRow[col] !== null) {
        col++;
      }
      // If no space to the right, try to the left
      if (col >= colCount) {
        col = item.col - 1;
        while (col >= 0 && gridRow[col] !== null) {
          col--;
        }
      }
      // If still no space, skip this stack (shouldn't happen normally)
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
  };
}

/**
 * Find the stack to the left in the same row
 * Returns null if at the leftmost position or no stack exists to the left
 */
export function findStackLeft(gridMap: GridMap, currentStackId: string): string | null {
  const cell = gridMap.cells.get(currentStackId);
  if (!cell) return null;

  // Search for the nearest occupied cell to the left
  for (let c = cell.col - 1; c >= 0; c--) {
    const stackId = gridMap.grid[cell.row]?.[c];
    if (stackId) return stackId;
  }

  return null; // At edge, stay put
}

/**
 * Find the stack to the right in the same row
 * Returns null if at the rightmost position or no stack exists to the right
 */
export function findStackRight(gridMap: GridMap, currentStackId: string): string | null {
  const cell = gridMap.cells.get(currentStackId);
  if (!cell) return null;

  // Search for the nearest occupied cell to the right
  for (let c = cell.col + 1; c < gridMap.colCount; c++) {
    const stackId = gridMap.grid[cell.row]?.[c];
    if (stackId) return stackId;
  }

  return null; // At edge, stay put
}

/**
 * Navigate up - either within a stack or to the stack above
 *
 * If not at the first card of current stack: move to previous card
 * If at first card: jump to LAST card of the stack above (same column)
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

  // At first card - try to jump to stack above
  const cell = gridMap.cells.get(stackId);
  if (!cell) return { stackId, cardIndex: 0 };

  // Search for the nearest occupied cell above in the same column
  for (let r = cell.row - 1; r >= 0; r--) {
    const aboveStackId = gridMap.grid[r]?.[cell.col];
    if (aboveStackId) {
      const aboveStack = getStack(aboveStackId);
      if (aboveStack) {
        // Focus the LAST card of the stack above (use visible count if available)
        const cardCount = getVisibleCardCount ? getVisibleCardCount(aboveStack) : aboveStack.cardIds.length;
        const lastIndex = Math.max(0, cardCount - 1);
        return { stackId: aboveStackId, cardIndex: lastIndex };
      }
    }
  }

  // No stack above, stay at current position
  return { stackId, cardIndex: 0 };
}

/**
 * Navigate down - either within a stack or to the stack below
 *
 * If not at the last card of current stack: move to next card
 * If at last card: jump to FIRST card of the stack below (same column)
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

  // At last card - try to jump to stack below
  const cell = gridMap.cells.get(stackId);
  if (!cell) return { stackId, cardIndex: lastIndex };

  // Search for the nearest occupied cell below in the same column
  for (let r = cell.row + 1; r < gridMap.rowCount; r++) {
    const belowStackId = gridMap.grid[r]?.[cell.col];
    if (belowStackId) {
      // Focus the FIRST card of the stack below
      return { stackId: belowStackId, cardIndex: 0 };
    }
  }

  // No stack below, stay at current position
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
