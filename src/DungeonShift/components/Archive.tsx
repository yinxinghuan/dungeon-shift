import { useMemo, useState } from 'react';
import { isInAigram, openAigramProfile, telegramId } from '@shared/runtime/bridge';
import { SAMPLE_DUNGEON } from '../dungeons';
import type { DungeonAuthor, DungeonConfig, WallEntry } from '../types';
import DungeonMiniMap from './DungeonMiniMap';
import { t } from '../i18n';
import { ArrowIcon, ArchiveIcon } from '../icons';

type Scope = 'community' | 'mine';

function Avatar({ entry, self }: { entry: WallEntry; self: boolean }) {
  if (self) return <span className="ds-author__self">{t('you')}</span>;
  const name = entry.userName || t('sampleKeeper');
  return <button type="button" className="ds-author" disabled={!isInAigram || entry.userId === 'sample'} onClick={(event) => { event.stopPropagation(); openAigramProfile(entry.userId); }}>
    <span className="ds-author__avatar">{entry.userAvatarUrl ? <img src={entry.userAvatarUrl} alt="" draggable={false}/> : name.charAt(0).toUpperCase()}</span>
    <span className="ds-author__name">{name}</span>
  </button>;
}

export default function Archive({ community, mine, loaded, notice, onBack, onBuild, onRaid }: { community: WallEntry[]; mine: DungeonConfig[]; loaded: boolean; notice?: string; onBack: () => void; onBuild: () => void; onRaid: (dungeon: DungeonConfig, author?: DungeonAuthor) => void }) {
  const [scope, setScope] = useState<Scope>('community');
  const entries = useMemo(() => {
    const mineEntries: WallEntry[] = mine.map((dungeon) => ({ userId: 'self', userName: t('you'), dungeon }));
    if (scope === 'mine') return mineEntries;
    const myId = telegramId ? String(telegramId) : '';
    const others = community.filter((entry) => entry.userId !== myId);
    const merged = [...mineEntries, ...others].sort((a, b) => b.dungeon.createdAt - a.dungeon.createdAt);
    const unique = [...new Map(merged.map((entry) => [entry.dungeon.id, entry])).values()];
    return unique.length ? unique.slice(0, 24) : [{ userId: 'sample', userName: t('sampleKeeper'), dungeon: SAMPLE_DUNGEON }];
  }, [community, mine, scope]);

  return <section className="ds-archive" aria-labelledby="archive-title">
    <header className="ds-panel-head"><button onPointerDown={onBack} aria-label={t('back')}><ArrowIcon/></button><div><small>{t('archiveKicker')}</small><h2 id="archive-title" aria-label={t('archiveTitle')}>{t('archiveDisplay')}</h2></div><ArchiveIcon/></header>
    <p className="ds-archive__brief">{t('archiveBrief')}</p>
    {notice && <div className="ds-archive__notice" role="status">{notice}</div>}
    <div className="ds-tabs" role="tablist"><button role="tab" aria-selected={scope === 'community'} className={scope === 'community' ? 'is-active' : ''} onPointerDown={() => setScope('community')}>{t('community')}</button><button role="tab" aria-selected={scope === 'mine'} className={scope === 'mine' ? 'is-active' : ''} onPointerDown={() => setScope('mine')}>{t('mine')} <span>{mine.length}</span></button></div>
    <div className="ds-archive__list">
      {!loaded && scope === 'community' && <div className="ds-empty">{t('loading')}</div>}
      {loaded && entries.length === 0 && <div className="ds-empty">{t('emptyArchive')}</div>}
      {(loaded || scope === 'mine') && entries.map((entry) => {
        const self = entry.userId === 'self' || (!!telegramId && entry.userId === String(telegramId));
        return <article className="ds-dungeon-card" key={entry.dungeon.id} onClick={() => onRaid(entry.dungeon, { userId: entry.userId, userName: entry.userName, userAvatarUrl: entry.userAvatarUrl })}>
          <DungeonMiniMap dungeon={entry.dungeon}/>
          <div className="ds-dungeon-card__body"><small>{entry.dungeon.budgetUsed}/12 · {entry.dungeon.guards.length} {t('guard')}</small><h3>{entry.dungeon.name}</h3><div className="ds-dungeon-card__threat" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < Math.ceil(entry.dungeon.budgetUsed / 3) ? 'is-on' : ''}/>)}</div><div className="ds-dungeon-card__foot"><span>{t('by')}</span><Avatar entry={entry} self={self}/><button type="button" className="ds-dungeon-card__raid" onClick={(event) => { event.stopPropagation(); onRaid(entry.dungeon, { userId: entry.userId, userName: entry.userName, userAvatarUrl: entry.userAvatarUrl }); }}>{t('raidThis')}<ArrowIcon/></button></div></div>
        </article>;
      })}
    </div>
    {!isInAigram && scope === 'community' && <a className="ds-alteru" href="https://alteru.app" target="_blank" rel="noreferrer">{t('getAlterU')}</a>}
    <button className="ds-button ds-button--secondary ds-archive__build" onPointerDown={onBuild}>{t('build')}</button>
  </section>;
}
