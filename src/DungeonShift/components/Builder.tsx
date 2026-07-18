import { useMemo, useState } from 'react';
import { BUDGET, SAMPLE_DUNGEON, START, TOOL_COST, VAULT, isSolvable, sameCell } from '../dungeons';
import type { BuilderTool, DungeonConfig } from '../types';
import DungeonMiniMap from './DungeonMiniMap';
import { t } from '../i18n';
import { ArrowIcon, EraseIcon, GuardIcon, RuneIcon, SpikeIcon, WallIcon } from '../icons';

const tools: Array<{ id: BuilderTool; icon: typeof WallIcon; cost: number }> = [
  { id: 'wall', icon: WallIcon, cost: 1 }, { id: 'spike', icon: SpikeIcon, cost: 2 },
  { id: 'rune', icon: RuneIcon, cost: 2 }, { id: 'guard', icon: GuardIcon, cost: 3 },
  { id: 'erase', icon: EraseIcon, cost: 0 },
];

function blankDungeon(): DungeonConfig {
  return { id: '', version: 1, name: '', createdAt: 0, blocked: [], traps: [], guards: [], budgetUsed: 0 };
}

export default function Builder({ number, onBack, onPublish, initial }: { number: number; onBack: () => void; onPublish: (dungeon: DungeonConfig) => void; initial?: DungeonConfig }) {
  const [tool, setTool] = useState<BuilderTool>('wall');
  const [draft, setDraft] = useState<DungeonConfig>(() => initial ? { ...initial, id: '', createdAt: 0 } : blankDungeon());
  const [message, setMessage] = useState('');
  const remaining = BUDGET - draft.budgetUsed;
  const valid = useMemo(() => isSolvable(draft) && draft.guards.length > 0 && draft.budgetUsed > 0, [draft]);

  const onCell = (c: number, r: number) => {
    const cell = { c, r };
    if (sameCell(cell, START) || sameCell(cell, VAULT)) { setMessage(t('builderFixed')); return; }
    const wallIndex = draft.blocked.findIndex((x) => sameCell(x, cell));
    const trapIndex = draft.traps.findIndex((x) => sameCell(x.cell, cell));
    const guardIndex = draft.guards.findIndex((x) => x.route.some((point) => sameCell(point, cell)));
    const occupiedCost = wallIndex >= 0 ? 1 : trapIndex >= 0 ? 2 : guardIndex >= 0 ? 3 : 0;
    const replacedGuardCost = tool === 'guard' && draft.guards.length > 0 && guardIndex < 0 ? 3 : 0;
    const next = { ...draft, blocked: [...draft.blocked], traps: [...draft.traps], guards: [...draft.guards] };
    if (wallIndex >= 0) next.blocked.splice(wallIndex, 1);
    if (trapIndex >= 0) next.traps.splice(trapIndex, 1);
    if (guardIndex >= 0) next.guards.splice(guardIndex, 1);
    if (tool !== 'erase') {
      const nextCost = TOOL_COST[tool];
      if (draft.budgetUsed - occupiedCost - replacedGuardCost + nextCost > BUDGET) { setMessage(t('builderBudgetError')); return; }
      if (tool === 'wall') next.blocked.push(cell);
      if (tool === 'spike' || tool === 'rune') next.traps.push({ id: crypto.randomUUID(), type: tool, cell });
      if (tool === 'guard') {
        const neighbor = c < 4 ? { c: c + 1, r } : { c: c - 1, r };
        if (next.blocked.some((x) => sameCell(x, neighbor)) || sameCell(neighbor, START) || sameCell(neighbor, VAULT)) { setMessage(t('builderGuardError')); return; }
        next.guards = [{ id: crypto.randomUUID(), type: 'vampire', route: [cell, neighbor] }];
      }
    }
    next.budgetUsed = draft.budgetUsed - occupiedCost - replacedGuardCost + (tool === 'erase' ? 0 : TOOL_COST[tool]);
    setDraft(next); setMessage('');
  };

  const publish = () => {
    if (!valid) { setMessage(draft.guards.length === 0 ? t('builderNeedGuard') : t('builderPathError')); return; }
    onPublish({ ...draft, id: crypto.randomUUID(), name: `${t('shift')} ${String(number).padStart(2, '0')}`, createdAt: Date.now() });
  };

  const useTemplate = () => setDraft({ ...SAMPLE_DUNGEON, id: '', name: '', createdAt: 0, blocked: [...SAMPLE_DUNGEON.blocked], traps: SAMPLE_DUNGEON.traps.map((x) => ({ ...x, id: crypto.randomUUID() })), guards: SAMPLE_DUNGEON.guards.map((x) => ({ ...x, id: crypto.randomUUID(), route: [...x.route] })) });

  return <section className="ds-builder" aria-labelledby="builder-title">
    <header className="ds-panel-head"><button onPointerDown={onBack} aria-label={t('back')}><ArrowIcon/></button><div><small>{t('keeperMode')}</small><h2 id="builder-title" aria-label={t('builderTitle')}>{t('builderDisplay')}</h2></div><strong>{String(remaining).padStart(2, '0')}<span>{t('budgetLeft')}</span></strong></header>
    <p className="ds-builder__brief">{t('builderBrief')}</p>
    <DungeonMiniMap dungeon={draft} interactive onCell={onCell} />
    <button className="ds-builder__template" onClick={useTemplate}>{t('template')}</button>
    <div className="ds-tools" role="toolbar" aria-label={t('tools')}>
      {tools.map(({ id, icon: ToolIcon, cost }) => <button key={id} className={tool === id ? 'is-active' : ''} onClick={() => setTool(id)} aria-pressed={tool === id}><ToolIcon/><span>{t(id)}</span>{cost > 0 && <small>{cost}</small>}</button>)}
    </div>
    <div className={`ds-builder__message ${valid ? 'is-ready' : message || (draft.guards.length > 0 && !isSolvable(draft)) ? 'is-error' : ''}`} aria-live="polite">{message || (valid ? t('builderReady') : draft.guards.length > 0 && !isSolvable(draft) ? t('builderPathError') : t('builderHint'))}</div>
    <button className="ds-button ds-button--primary" disabled={!valid} onPointerDown={publish}><span>{t('publish')}</span><ArrowIcon/></button>
  </section>;
}
