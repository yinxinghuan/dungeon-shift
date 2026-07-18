import type { Cell, DungeonConfig } from './types';

export const COLS = 5;
export const ROWS = 7;
export const START: Cell = { c: 2, r: 6 };
export const VAULT: Cell = { c: 2, r: 0 };
export const BUDGET = 12;
export const TOOL_COST = { wall: 1, spike: 2, rune: 2, guard: 3, erase: 0 } as const;

export const SAMPLE_DUNGEON: DungeonConfig = {
  id: 'sample-archive-01',
  version: 1,
  name: 'ARCHIVE 01',
  createdAt: 1,
  blocked: [
    { c: 0, r: 1 }, { c: 4, r: 1 }, { c: 1, r: 2 },
    { c: 0, r: 4 }, { c: 4, r: 4 }, { c: 1, r: 5 }, { c: 3, r: 5 },
  ],
  traps: [
    { id: 'sample-spike', type: 'spike', cell: { c: 2, r: 4 } },
    { id: 'sample-rune', type: 'rune', cell: { c: 3, r: 2 } },
  ],
  guards: [{ id: 'sample-guard', type: 'vampire', route: [{ c: 1, r: 3 }, { c: 3, r: 3 }] }],
  budgetUsed: 12,
};

export const cellKey = ({ c, r }: Cell) => `${c},${r}`;
export const sameCell = (a: Cell, b: Cell) => a.c === b.c && a.r === b.r;

export function isSolvable(dungeon: DungeonConfig): boolean {
  const blocked = new Set(dungeon.blocked.map(cellKey));
  const queue: Cell[] = [START];
  const seen = new Set([cellKey(START)]);
  while (queue.length) {
    const current = queue.shift()!;
    if (sameCell(current, VAULT)) return true;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { c: current.c + dc, r: current.r + dr };
      const key = cellKey(next);
      if (next.c < 0 || next.c >= COLS || next.r < 0 || next.r >= ROWS || blocked.has(key) || seen.has(key)) continue;
      seen.add(key); queue.push(next);
    }
  }
  return false;
}
