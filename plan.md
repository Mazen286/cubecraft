# Per-Copy XP Discount Amount & Improved Labels

## Problem Statement

1. **Deck Size Exclusion Label**: Currently shows "(campaign cards)" but exclusions can be for other reasons (investigator abilities, special rules, etc.). Need a more generic label.

2. **XP Discount Amount**: Currently assumes each discounted copy saves exactly 1 XP. But different effects can give different discount amounts:
   - Arcane Research: 1 XP discount
   - Some investigators/cards: Could be 2+ XP discount
   - Each copy could have a different discount amount

## Current Data Model

```typescript
// Current - only tracks COUNT of discounted copies (assumes 1 XP each)
xpDiscountSlots: Record<string, number>;  // code -> count of copies with 1 XP discount

// Example: 2 copies of Sixth Sense (4), 1 discounted
xpDiscountSlots: { "60425": 1 }  // means 1 copy has 1 XP discount
// Total XP: 4 + (4-1) = 7 XP
```

## Proposed Data Model

```typescript
// New - tracks discount AMOUNT per copy
xpDiscountSlots: Record<string, number[]>;  // code -> array of discount amounts per copy

// Example: 2 copies of Sixth Sense (4)
// Copy 1: 2 XP discount (from Down the Rabbit Hole)
// Copy 2: 1 XP discount (from Arcane Research)
xpDiscountSlots: { "60425": [2, 1] }
// Total XP: (4-2) + (4-1) = 2 + 3 = 5 XP
```

---

## Implementation Plan

### Phase 1: Update Data Model

**File**: `src/types/arkham.ts`
```typescript
// Change from:
xpDiscountSlots?: Record<string, number>;

// To:
xpDiscountSlots?: Record<string, number[]>;
```

**File**: `src/services/arkhamDeckService.ts`
```typescript
// Update ArkhamDeckMeta interface
interface ArkhamDeckMeta {
  ignoreDeckSizeSlots?: Record<string, number>;
  xpDiscountSlots?: Record<string, number[]>;  // Changed
}
```

### Phase 2: Update Context

**File**: `src/context/ArkhamDeckBuilderContext.tsx`

1. Update state type:
```typescript
xpDiscountSlots: Record<string, number[]>;
```

2. Update `calculateXpCostWithDiscounts`:
```typescript
function calculateXpCostWithDiscounts(
  slots: Record<string, number>,
  xpDiscountSlots: Record<string, number[]>
): number {
  let totalXp = 0;

  for (const [code, quantity] of Object.entries(slots)) {
    const card = arkhamCardService.getCard(code);
    if (card && card.xp) {
      const discounts = xpDiscountSlots[code] || [];

      for (let i = 0; i < quantity; i++) {
        const discount = discounts[i] || 0;
        totalXp += Math.max(0, card.xp - discount);
      }
    }
  }

  return totalXp;
}
```

3. Update action type:
```typescript
// Change from:
| { type: 'SET_XP_DISCOUNT'; payload: { code: string; discountedCount: number } }

// To:
| { type: 'SET_XP_DISCOUNT'; payload: { code: string; copyIndex: number; discount: number } }
```

4. Update reducer case:
```typescript
case 'SET_XP_DISCOUNT': {
  const { code, copyIndex, discount } = action.payload;
  const newXpDiscountSlots = { ...state.xpDiscountSlots };
  const quantity = state.slots[code] || 0;

  // Initialize array if needed
  if (!newXpDiscountSlots[code]) {
    newXpDiscountSlots[code] = new Array(quantity).fill(0);
  }

  // Ensure array is correct size
  while (newXpDiscountSlots[code].length < quantity) {
    newXpDiscountSlots[code].push(0);
  }

  // Set discount for specific copy
  if (copyIndex >= 0 && copyIndex < quantity) {
    newXpDiscountSlots[code][copyIndex] = discount;
  }

  // Clean up if all zeros
  if (newXpDiscountSlots[code].every(d => d === 0)) {
    delete newXpDiscountSlots[code];
  }

  const newXpSpent = calculateXpCostWithDiscounts(state.slots, newXpDiscountSlots);

  return {
    ...state,
    xpDiscountSlots: newXpDiscountSlots,
    xpSpent: newXpSpent,
    isDirty: true,
  };
}
```

5. Update REMOVE_CARD and SET_CARD_QUANTITY to properly resize discount arrays.

6. Update context methods:
```typescript
// Change from:
getXpDiscount: (code: string) => number;
setXpDiscount: (code: string, discountedCount: number) => void;

// To:
getXpDiscounts: (code: string) => number[];  // Returns array of discounts per copy
setXpDiscount: (code: string, copyIndex: number, discount: number) => void;
getTotalXpDiscount: (code: string) => number;  // Sum of all discounts for convenience
```

### Phase 3: Update UI

**File**: `src/components/arkham/ArkhamCardTable.tsx` (CardPreviewPanel)

Replace the single "Copies with XP discount" row with per-copy controls:

```tsx
{/* XP Discount control - per copy */}
{isInMainDeck && cardXp > 0 && (
  <div className="space-y-2">
    <span className="text-sm text-gray-300 block text-center">
      XP Discount per copy:
    </span>
    {Array.from({ length: quantityInDeck }).map((_, copyIndex) => {
      const discount = xpDiscounts[copyIndex] || 0;
      return (
        <div key={copyIndex} className="flex items-center justify-center gap-2">
          <span className="text-xs text-gray-400 w-16">Copy {copyIndex + 1}:</span>
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3].map((d) => (
              <button
                key={d}
                onClick={() => setXpDiscount(card.code, copyIndex, d)}
                disabled={d > cardXp}  // Can't discount more than card costs
                className={`w-7 h-7 rounded text-sm font-medium ${
                  discount === d
                    ? 'bg-green-500 text-black'
                    : d > cardXp
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-cc-darker text-gray-400 hover:text-white hover:bg-cc-border'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          {discount > 0 && (
            <span className="text-xs text-green-400">
              ({cardXp} → {cardXp - discount} XP)
            </span>
          )}
        </div>
      );
    })}
  </div>
)}
```

**File**: `src/components/arkham/ArkhamDeckPanel.tsx`

Update card row XP display to show per-copy costs:
```tsx
{/* XP column - show breakdown when discounts vary */}
{xp > 0 && (
  <div className="flex flex-col items-center">
    {discounts.some(d => d > 0) ? (
      <>
        <span className="text-[10px] text-green-400">
          {discounts.map((d, i) => Math.max(0, xp - d)).join('+')}
        </span>
        <span className="text-[9px] text-gray-500">
          = {discounts.reduce((sum, d) => sum + Math.max(0, xp - d), 0)} XP
        </span>
      </>
    ) : (
      <span className="text-sm font-bold text-yellow-400">
        {xp * quantity}
      </span>
    )}
    {/* D button to open discount editor */}
  </div>
)}
```

### Phase 4: Update Labels

**Files**: `ArkhamCardTable.tsx`, `ArkhamDeckPanel.tsx`, `AllCardsTable.tsx`

Change all occurrences of "(campaign cards)" to more generic text:
- Tooltip: "Mark copies as not counting towards deck size (story assets, investigator abilities, etc.)"
- Short label remains "NC" (Not Counted)

---

## UI Design Summary

### Card Preview Panel (Bottom Sheet)
```
XP Discount per copy:
Copy 1:  [0] [1] [2] [3]  (4 → 2 XP)  ← selected 2
Copy 2:  [0] [1] [2] [3]  (4 → 3 XP)  ← selected 1

Copies that don't count:  [0] [1] [2]  (for deck size)
```

### Card Row (Deck Panel)
```
| Cost | Name         | XP      | Icons | Qty |
|  3   | Sixth Sense  | 2+3=5   | ⚙️⚙️   | 2 [D][NC][-][+][→] |
```

Where:
- `2+3=5` shows the per-copy effective XP costs
- `[D]` opens discount editor
- `[NC]` cycles deck size exclusion

---

## Migration

Existing data uses `xpDiscountSlots: Record<string, number>` (count of 1-XP discounts).

Migration in `loadDeck`:
```typescript
// Convert old format to new format
if (typeof row.meta?.xpDiscountSlots === 'object') {
  const oldFormat = row.meta.xpDiscountSlots as Record<string, number>;
  const newFormat: Record<string, number[]> = {};

  for (const [code, count] of Object.entries(oldFormat)) {
    if (typeof count === 'number' && !Array.isArray(count)) {
      // Old format: convert count to array of 1s
      newFormat[code] = new Array(count).fill(1);
    } else if (Array.isArray(count)) {
      // Already new format
      newFormat[code] = count;
    }
  }

  deckData.xpDiscountSlots = newFormat;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/arkham.ts` | Change `xpDiscountSlots` type to `number[]` |
| `src/services/arkhamDeckService.ts` | Update type, add migration |
| `src/context/ArkhamDeckBuilderContext.tsx` | Update state, reducer, methods, calculations |
| `src/components/arkham/ArkhamCardTable.tsx` | Per-copy discount UI in preview |
| `src/components/arkham/ArkhamDeckPanel.tsx` | Update XP display, fix labels |
| `src/components/arkham/AllCardsTable.tsx` | Fix labels |

---

## Testing

1. Add 2x Shrivelling (5) - a 5 XP card
2. Set Copy 1 discount to 2 (from Down the Rabbit Hole)
3. Set Copy 2 discount to 1 (from Arcane Research)
4. Verify total XP shows: (5-2) + (5-1) = 3 + 4 = 7 XP
5. Card row should show "3+4=7" in XP column
6. Save and reload - verify discounts persist
7. Test "doesn't count" tooltip shows generic text, not "campaign cards"
