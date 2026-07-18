import { useEffect, useState } from 'react';
import { isInAigram, openAigramProfile } from '@shared/runtime/bridge';
import type { LeaderboardEntry } from '@shared/leaderboard/useGameScore';
import { t } from '../i18n';
import { CloseIcon, RankIcon } from '../icons';

export default function RankPanel({ fetch, onClose }: { fetch: () => Promise<LeaderboardEntry[]>; onClose: () => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(isInAigram);
  useEffect(() => { let alive = true; if (!isInAigram) return; fetch().then((data) => alive && setEntries(data)).finally(() => alive && setLoading(false)); return () => { alive = false; }; }, [fetch]);
  return <section className="ds-rank" aria-labelledby="rank-title">
    <header className="ds-panel-head"><RankIcon/><div><small>{t('champion')}</small><h2 id="rank-title" aria-label={t('rankTitle')}>{t('rankDisplay')}</h2></div><button onPointerDown={onClose} aria-label={t('close')}><CloseIcon/></button></header>
    <p>{t('rankBrief')}</p>
    <div className="ds-rank__list">
      {loading && <div className="ds-empty">{t('loading')}</div>}
      {!loading && !isInAigram && <div className="ds-empty">{t('openAlterURank')}<a href="https://alteru.app" target="_blank" rel="noreferrer">{t('getAlterURank')}</a></div>}
      {!loading && isInAigram && entries.length === 0 && <div className="ds-empty">{t('noRanks')}</div>}
      {entries.map((entry) => entry.isMe ? (
        <div key={entry.user_id} className="ds-rank__row is-me">
          <span className="ds-rank__pos">{entry.rank}</span>
          <span className="ds-rank__self">{t('you')}</span>
          <strong>{entry.score.toLocaleString()}</strong>
        </div>
      ) : (
        <button key={entry.user_id} type="button" className="ds-rank__row" disabled={!isInAigram} onClick={() => openAigramProfile(entry.user_id)}>
          <span className="ds-rank__pos">{entry.rank}</span>
          <span className="ds-author__avatar">{entry.avatar_url ? <img src={entry.avatar_url} alt="" draggable={false}/> : entry.name.charAt(0).toUpperCase()}</span>
          <span className="ds-rank__name">{entry.name}</span>
          <strong>{entry.score.toLocaleString()}</strong>
        </button>
      ))}
    </div>
  </section>;
}
