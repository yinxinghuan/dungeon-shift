import { COLS, ROWS, START, VAULT, cellKey } from '../dungeons';
import type { DungeonConfig } from '../types';

export default function DungeonMiniMap({ dungeon, interactive, onCell }: { dungeon: DungeonConfig; interactive?: boolean; onCell?: (c: number, r: number) => void }) {
  const blocked = new Set(dungeon.blocked.map(cellKey));
  const traps = new Map(dungeon.traps.map((trap) => [cellKey(trap.cell), trap.type]));
  const guards = new Set(dungeon.guards.flatMap((guard) => guard.route.slice(0, 1).map(cellKey)));
  return (
    <div className={`ds-map ${interactive ? 'ds-map--interactive' : ''}`} style={{ '--ds-cols': COLS, '--ds-rows': ROWS } as React.CSSProperties}>
      {Array.from({ length: COLS * ROWS }, (_, index) => {
        const c = index % COLS, r = Math.floor(index / COLS), key = `${c},${r}`;
        const role = c === START.c && r === START.r ? 'entrance' : c === VAULT.c && r === VAULT.r ? 'vault' : blocked.has(key) ? 'wall' : guards.has(key) ? 'guard' : traps.get(key) || 'floor';
        return interactive ? (
          <button type="button" key={key} className={`ds-map__cell is-${role}`} onClick={() => onCell?.(c, r)} aria-label={`${c + 1}, ${r + 1}`}><span /></button>
        ) : <span key={key} className={`ds-map__cell is-${role}`}><i /></span>;
      })}
    </div>
  );
}
