import { useMemo, useState } from 'react';
import { BUDGET, COLS, ROWS, SAMPLE_DUNGEON, START, TOOL_COST, VAULT, sameCell, validateDungeon } from '../dungeons';
import { GUARD_NAME_KEYS, GUARD_TYPES, cycleRoster, guardTypeForBuild, normalizeGuardType } from '../roster';
import type { BuilderTool, DungeonConfig, GuardType } from '../types';
import DungeonMiniMap from './DungeonMiniMap';
import { t } from '../i18n';
import { ArrowIcon, EraseIcon, GuardIcon, RuneIcon, SpikeIcon, WallIcon } from '../icons';
import GuardPreview from './GuardPreview';

const tools: Array<{ id: BuilderTool; icon: typeof WallIcon; cost: number }> = [
  { id: 'wall', icon: WallIcon, cost: 1 }, { id: 'spike', icon: SpikeIcon, cost: 2 },
  { id: 'rune', icon: RuneIcon, cost: 2 }, { id: 'guard', icon: GuardIcon, cost: 3 },
  { id: 'erase', icon: EraseIcon, cost: 0 },
];

function blankDungeon(): DungeonConfig {
  return { id: '', version: 1, name: '', createdAt: 0, blocked: [], traps: [], guards: [], budgetUsed: 0 };
}

export default function Builder({ number, onBack, onPublish, initial }: { number: number; onBack: () => void; onPublish: (dungeon: DungeonConfig) => boolean; initial?: DungeonConfig }) {
  const [tool, setTool] = useState<BuilderTool>('wall');
  const [draft, setDraft] = useState<DungeonConfig>(() => initial ? { ...initial, id: '', createdAt: 0 } : blankDungeon());
  const [guardType, setGuardType] = useState<GuardType>(() => normalizeGuardType(initial?.guards[0]?.type, guardTypeForBuild(number)));
  const [message, setMessage] = useState('');
  const remaining = BUDGET - draft.budgetUsed;
  const validation = useMemo(() => validateDungeon(draft), [draft]);
  const valid = validation.code === 'ready' && draft.budgetUsed > 0;

  const chooseGuardType = (nextType: GuardType) => {
    setGuardType(nextType);
    setDraft((current) => ({ ...current, guards: current.guards.map((guard) => ({ ...guard, type: nextType })) }));
    setMessage('');
  };

  const cycleGuard = (direction: -1 | 1) => chooseGuardType(cycleRoster(GUARD_TYPES, guardType, direction));

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
        const neighbor = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .map(([dc, dr]) => ({ c: c + dc, r: r + dr }))
          .find((candidate) => candidate.c >= 0 && candidate.c < COLS && candidate.r >= 0 && candidate.r < ROWS
            && !next.blocked.some((x) => sameCell(x, candidate))
            && !next.traps.some((x) => sameCell(x.cell, candidate))
            && !sameCell(candidate, START) && !sameCell(candidate, VAULT));
        if (!neighbor) { setMessage(t('builderGuardError')); return; }
        next.guards = [{ id: crypto.randomUUID(), type: guardType, route: [cell, neighbor] }];
      }
    }
    next.budgetUsed = draft.budgetUsed - occupiedCost - replacedGuardCost + (tool === 'erase' ? 0 : TOOL_COST[tool]);
    setDraft(next); setMessage('');
  };

  const publish = () => {
    if (!valid) { setMessage(t(validation.code === 'missing-guard' ? 'builderNeedGuard' : validation.code === 'blocked-route' ? 'builderPathError' : validation.code === 'lethal-route' ? 'builderLethalError' : 'builderInvalidGuard')); return; }
    const accepted = onPublish({ ...draft, id: crypto.randomUUID(), name: `${t('shift')} ${String(number).padStart(2, '0')}`, createdAt: Date.now() });
    if (!accepted) setMessage(t('publishRejected'));
  };

  const useTemplate = () => {
    const templateGuard = normalizeGuardType(SAMPLE_DUNGEON.guards[0]?.type);
    setGuardType(templateGuard);
    setDraft({ ...SAMPLE_DUNGEON, id: '', name: '', createdAt: 0, blocked: [...SAMPLE_DUNGEON.blocked], traps: SAMPLE_DUNGEON.traps.map((x) => ({ ...x, id: crypto.randomUUID() })), guards: SAMPLE_DUNGEON.guards.map((x) => ({ ...x, type: templateGuard, id: crypto.randomUUID(), route: [...x.route] })) });
    setMessage('');
  };

  const validationCopy = validation.code === 'ready' ? 'builderReady'
    : validation.code === 'blocked-route' ? 'builderPathError'
      : validation.code === 'lethal-route' ? 'builderLethalError'
        : validation.code === 'invalid-guard' ? 'builderInvalidGuard' : 'builderHint';
  const guardIndex = GUARD_TYPES.indexOf(guardType);

  return <section className="ds-builder" aria-labelledby="builder-title" data-guard-type={guardType} data-validation={validation.code} data-minimum-damage={validation.minimumDamage}>
    <header className="ds-panel-head"><button onPointerDown={onBack} aria-label={t('back')}><ArrowIcon/></button><div><small>{t('keeperMode')}</small><h2 id="builder-title" aria-label={t('builderTitle')}>{t('builderDisplay')}</h2></div><strong>{String(remaining).padStart(2, '0')}<span>{t('budgetLeft')}</span></strong></header>
    <p className="ds-builder__brief">{t('builderBrief')}</p>
    <DungeonMiniMap dungeon={draft} interactive onCell={onCell} />
    <div className="ds-builder__utility"><button className="ds-builder__template" onClick={useTemplate}>{t('template')}</button><div className="ds-guard-select" role="group" aria-label={t('guardRoster')}><button type="button" onPointerDown={() => cycleGuard(-1)} aria-label={t('previousGuard')}><ArrowIcon/></button><span><GuardPreview type={guardType}/><span className="ds-guard-select__copy"><small><b>{t('guardRoster')}</b><i>{String(guardIndex + 1).padStart(2, '0')}·{String(GUARD_TYPES.length).padStart(2, '0')}</i></small><strong>{t(GUARD_NAME_KEYS[guardType])}</strong></span></span><button type="button" onPointerDown={() => cycleGuard(1)} aria-label={t('nextGuard')}><ArrowIcon/></button></div></div>
    <div className="ds-tools" role="toolbar" aria-label={t('tools')}>
      {tools.map(({ id, icon: ToolIcon, cost }) => <button key={id} className={tool === id ? 'is-active' : ''} onClick={() => setTool(id)} aria-pressed={tool === id}><ToolIcon/><span>{t(id)}</span>{cost > 0 && <small>{cost}</small>}</button>)}
    </div>
    <div className={`ds-builder__message ${valid ? 'is-ready' : message || validation.code !== 'missing-guard' ? 'is-error' : ''}`} data-validation={validation.code} data-minimum-damage={validation.minimumDamage} aria-live="polite">{message || t(validationCopy)}</div>
    <button className="ds-button ds-button--primary" disabled={!valid} onPointerDown={publish}><span>{t('publish')}</span><ArrowIcon/></button>
  </section>;
}
