import type { Cell, DungeonConfig } from './types';
import { normalizeGuardType } from './roster';

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
export const dungeonPlayEvent = (dungeonId: string) => `dungeon_play:${dungeonId}`;

export type DungeonValidationCode = 'ready' | 'missing-guard' | 'blocked-route' | 'lethal-route' | 'invalid-guard';
export interface DungeonValidation {
  code: DungeonValidationCode;
  minimumDamage: number;
  routeSteps: number;
}

const inBounds = ({ c, r }: Cell) => c >= 0 && c < COLS && r >= 0 && r < ROWS;

function parseCell(value: unknown): Cell | null {
  if (!value || typeof value !== 'object') return null;
  const cell = value as Partial<Cell>;
  if (!Number.isInteger(cell.c) || !Number.isInteger(cell.r)) return null;
  const parsed = { c: Number(cell.c), r: Number(cell.r) };
  return inBounds(parsed) ? parsed : null;
}

export function normalizeDungeon(value: unknown): DungeonConfig | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<DungeonConfig>;
  if (source.version !== 1 || typeof source.id !== 'string' || !source.id || !Array.isArray(source.blocked) || !Array.isArray(source.traps) || !Array.isArray(source.guards)) return null;
  const blocked = source.blocked.map(parseCell);
  if (blocked.some((cell) => !cell)) return null;
  const traps = source.traps.map((trap) => {
    const cell = parseCell(trap?.cell);
    return cell && (trap?.type === 'spike' || trap?.type === 'rune') ? { id: String(trap.id || `${trap.type}-${cellKey(cell)}`), type: trap.type, cell } : null;
  });
  if (traps.some((trap) => !trap)) return null;
  const guards = source.guards.map((guard) => {
    if (!guard || !Array.isArray(guard.route)) return null;
    const route = guard.route.map(parseCell);
    if (route.some((cell) => !cell)) return null;
    return { id: String(guard.id || `guard-${source.id}`), type: normalizeGuardType(guard.type), route: route as Cell[] };
  });
  if (guards.some((guard) => !guard)) return null;
  return {
    id: source.id,
    version: 1,
    name: typeof source.name === 'string' && source.name ? source.name : 'SHIFT',
    createdAt: Number.isFinite(source.createdAt) ? Number(source.createdAt) : 0,
    blocked: blocked as Cell[],
    traps: traps as DungeonConfig['traps'],
    guards: guards as DungeonConfig['guards'],
    budgetUsed: Number.isFinite(source.budgetUsed) ? Math.max(0, Number(source.budgetUsed)) : 0,
  };
}

function layoutIsValid(dungeon: DungeonConfig): boolean {
  if (!Array.isArray(dungeon.blocked) || !Array.isArray(dungeon.traps) || !Array.isArray(dungeon.guards)) return false;
  const occupied = new Set<string>();
  for (const cell of dungeon.blocked) {
    if (!cell || !inBounds(cell)) return false;
    const key = cellKey(cell);
    if (sameCell(cell, START) || sameCell(cell, VAULT) || occupied.has(key)) return false;
    occupied.add(key);
  }
  for (const trap of dungeon.traps) {
    if (!trap?.cell || !inBounds(trap.cell)) return false;
    const key = cellKey(trap.cell);
    if ((trap.type !== 'spike' && trap.type !== 'rune') || sameCell(trap.cell, START) || sameCell(trap.cell, VAULT) || occupied.has(key)) return false;
    occupied.add(key);
  }
  return true;
}

function hasWalkableRoute(dungeon: DungeonConfig): boolean {
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

function guardRouteIsValid(dungeon: DungeonConfig): boolean {
  if (dungeon.guards.length !== 1) return false;
  const blocked = new Set(dungeon.blocked.map(cellKey));
  const occupied = new Set(dungeon.traps.map((trap) => cellKey(trap.cell)));
  const route = dungeon.guards[0].route;
  if (!Array.isArray(route) || route.length < 2) return false;
  const start = route[0], end = route[route.length - 1];
  if (!start || !end || !inBounds(start) || !inBounds(end) || sameCell(start, end)) return false;
  if (start.c !== end.c && start.r !== end.r) return false;
  const dc = Math.sign(end.c - start.c), dr = Math.sign(end.r - start.r);
  let cursor = { ...start };
  while (true) {
    const key = cellKey(cursor);
    if (!inBounds(cursor) || blocked.has(key) || occupied.has(key) || sameCell(cursor, START) || sameCell(cursor, VAULT)) return false;
    if (sameCell(cursor, end)) return true;
    cursor = { c: cursor.c + dc, r: cursor.r + dr };
  }
}

function solveMission(dungeon: DungeonConfig): { damage: number; steps: number } | null {
  const blocked = new Set(dungeon.blocked.map(cellKey));
  const spikes = new Set(dungeon.traps.filter((trap) => trap.type === 'spike').map((trap) => cellKey(trap.cell)));
  const queue: Array<{ cell: Cell; hasLoot: boolean; damage: number; steps: number }> = [{ cell: START, hasLoot: false, damage: 0, steps: 0 }];
  const best = new Map<string, number>([[`${cellKey(START)}|0`, 0]]);
  while (queue.length) {
    queue.sort((a, b) => a.damage - b.damage || a.steps - b.steps);
    const current = queue.shift()!;
    if (current.hasLoot && sameCell(current.cell, START)) return { damage: current.damage, steps: current.steps };
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { c: current.cell.c + dc, r: current.cell.r + dr };
      if (!inBounds(next) || blocked.has(cellKey(next))) continue;
      const hasLoot = current.hasLoot || sameCell(next, VAULT);
      const damage = current.damage + (spikes.has(cellKey(next)) ? 1 : 0);
      if (damage > 2) continue;
      const key = `${cellKey(next)}|${hasLoot ? 1 : 0}`;
      if ((best.get(key) ?? Infinity) <= damage) continue;
      best.set(key, damage);
      queue.push({ cell: next, hasLoot, damage, steps: current.steps + 1 });
    }
  }
  return null;
}

export function validateDungeon(dungeon: DungeonConfig): DungeonValidation {
  if (!dungeon || !layoutIsValid(dungeon)) return { code: 'invalid-guard', minimumDamage: 0, routeSteps: 0 };
  if (!dungeon.guards.length) return { code: 'missing-guard', minimumDamage: 0, routeSteps: 0 };
  if (!guardRouteIsValid(dungeon)) return { code: 'invalid-guard', minimumDamage: 0, routeSteps: 0 };
  if (!hasWalkableRoute(dungeon)) return { code: 'blocked-route', minimumDamage: 0, routeSteps: 0 };
  const solution = solveMission(dungeon);
  if (!solution) return { code: 'lethal-route', minimumDamage: 3, routeSteps: 0 };
  return { code: 'ready', minimumDamage: solution.damage, routeSteps: solution.steps };
}

export function isSolvable(dungeon: DungeonConfig): boolean {
  return validateDungeon(dungeon).code === 'ready';
}
