import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameSave } from '@shared/save';
import { useGameEvent } from '@shared/runtime/useGameEvent';
import { isInAigram, openAigramProfile, telegramId } from '@shared/runtime/bridge';
import { useGameScore } from '@shared/leaderboard/useGameScore';
import DungeonScene from './components/DungeonScene';
import Builder from './components/Builder';
import Archive from './components/Archive';
import RankPanel from './components/RankPanel';
import { ArrowIcon, ArchiveIcon, DashIcon, ExitIcon, LockIcon, RelicIcon, SmokeIcon } from './icons';
import { SAMPLE_DUNGEON, dungeonPlayEvent, normalizeDungeon, validateDungeon } from './dungeons';
import { INFILTRATOR_NAME_KEYS, INFILTRATOR_TYPES, cycleRoster, normalizeInfiltrator, stableInfiltratorFor } from './roster';
import { useDungeonWall } from './hooks/useDungeonWall';
import { unlockAudio } from './audio';
import { locale, t } from './i18n';
import type { DungeonAuthor, DungeonConfig, DungeonSave, DungeonSceneHandle, HudState, Phase, RunResult } from './types';
import aigramSrc from './img/aigram.svg';
import './DungeonShift.less';

const initialHud: HudState = { timeLeft: 75, health: 3, alert: 0, hasLoot: false, smokeReady: true, dashReady: true, dashArmed: false, alarms: 0 };
const fallbackInfiltrator = stableInfiltratorFor(String(telegramId || 'browser-guest'));
const emptySave: DungeonSave = { dungeons: [], totalBuilds: 0, bestScore: 0, infiltrator: fallbackInfiltrator };

function ResultAuthor({ author }: { author: DungeonAuthor }) {
  const self = author.userId === 'self' || author.userId === String(telegramId || '');
  if (author.userId === 'sample' || self) return <strong>{self ? t('you') : author.userName}</strong>;
  const name = author.userName || t('sampleKeeper');
  return <button onClick={() => isInAigram && openAigramProfile(author.userId)}><span className="ds-author__avatar">{author.userAvatarUrl ? <img src={author.userAvatarUrl} alt="" draggable={false}/> : name.charAt(0).toUpperCase()}</span><span>{name}</span></button>;
}

export default function DungeonShift() {
  const [phase, setPhase] = useState<Phase>('start');
  const [runId, setRunId] = useState(0);
  const [hud, setHud] = useState(initialHud);
  const [result, setResult] = useState<RunResult | null>(null);
  const [activeDungeon, setActiveDungeon] = useState<DungeonConfig>(SAMPLE_DUNGEON);
  const [activeAuthor, setActiveAuthor] = useState<DungeonAuthor>({ userId: 'sample', userName: t('sampleKeeper') });
  const [saveMirror, setSaveMirror] = useState<DungeonSave>(emptySave);
  const [archiveNotice, setArchiveNotice] = useState('');
  const seeded = useRef(false);
  const preRunBest = useRef(0);
  const sceneRef = useRef<DungeonSceneHandle>(null);
  const { savedData, persist, loaded: saveLoaded } = useGameSave<DungeonSave>('dungeon-shift');
  const wall = useDungeonWall();
  const { trigger, canEmit } = useGameEvent();
  const { submitScore, fetchLeaderboard } = useGameScore();

  useEffect(() => {
    if (savedData === undefined || seeded.current) return;
    seeded.current = true;
    const dungeons = (savedData?.dungeons || []).map(normalizeDungeon).filter((dungeon): dungeon is DungeonConfig => Boolean(dungeon));
    setSaveMirror({ ...emptySave, ...(savedData || {}), dungeons, infiltrator: normalizeInfiltrator(savedData?.infiltrator, fallbackInfiltrator) });
  }, [savedData]);

  const save = useCallback((next: DungeonSave) => { setSaveMirror(next); persist(next); }, [persist]);
  const start = useCallback((dungeon = activeDungeon, author = activeAuthor) => {
    if (validateDungeon(dungeon).code !== 'ready') { setArchiveNotice(t('publishRejected')); setPhase('archive'); return; }
    const selfId = String(telegramId || '');
    if (canEmit && author.userId && author.userId !== 'sample' && author.userId !== 'self' && author.userId !== selfId) trigger(dungeonPlayEvent(dungeon.id));
    unlockAudio(); setActiveDungeon(dungeon); setActiveAuthor(author); setHud(initialHud); setResult(null);
    preRunBest.current = saveMirror.bestScore || 0; setRunId((n) => n + 1); setPhase('playing');
  }, [activeAuthor, activeDungeon, canEmit, saveMirror.bestScore, trigger]);
  const home = () => { setPhase('start'); setResult(null); setArchiveNotice(''); };
  const openArchive = () => { wall.refresh(); setPhase('archive'); };

  const publishDungeon = (dungeon: DungeonConfig) => {
    if (validateDungeon(dungeon).code !== 'ready') return false;
    const next = { ...saveMirror, totalBuilds: saveMirror.totalBuilds + 1, dungeons: [dungeon, ...saveMirror.dungeons.filter((item) => item.id !== dungeon.id)].slice(0, 12) };
    save(next); wall.refresh(); setArchiveNotice(t('published')); setPhase('archive');
    return true;
  };

  const notifyKeeper = useCallback((next: RunResult) => {
    const target = activeAuthor.userId;
    if (!canEmit || !target || target === 'sample' || target === 'self' || target === String(telegramId || '')) return;
    trigger(next.won ? 'dungeon_escaped' : 'dungeon_stopped', { actions: [{ type: 'notify', target_user_id: target, message: { template: next.won ? `{sender_name} escaped ${activeDungeon.name} with ${next.score} points.` : `{sender_name} was stopped inside ${activeDungeon.name}.`, variables: ['sender_name'] } }] });
  }, [activeAuthor.userId, activeDungeon.name, canEmit, trigger]);

  const notifyBeatenPlayer = useCallback(async (myScore: number) => {
    if (!telegramId || !canEmit || myScore <= preRunBest.current) return;
    const rows = await fetchLeaderboard();
    const me = String(telegramId);
    const beaten = rows.filter((row) => String(row.user_id) !== me && row.score < myScore && row.score > preRunBest.current).sort((a, b) => b.score - a.score)[0];
    if (beaten) trigger('score_beat', { actions: [{ type: 'notify', target_user_id: beaten.user_id, message: { template: `{sender_name} just passed your Dungeon Shift record with ${myScore} points.`, variables: ['sender_name'] } }] });
  }, [canEmit, fetchLeaderboard, trigger]);

  const onFinish = useCallback((next: RunResult) => {
    setResult(next); setPhase(next.won ? 'won' : 'lost'); notifyKeeper(next);
    if (next.won) {
      submitScore(next.score);
      void notifyBeatenPlayer(next.score).catch(() => {});
      if (next.score > saveMirror.bestScore) save({ ...saveMirror, bestScore: next.score });
    }
  }, [notifyBeatenPlayer, notifyKeeper, save, saveMirror, submitScore]);
  const onHud = useCallback((next: HudState) => setHud(next), []);
  const resultReason = result?.reason === 'timeout' ? t('timeout') : result?.reason === 'caught' ? t('caught') : '';
  const sampleAuthor = useMemo(() => ({ userId: 'sample', userName: t('sampleKeeper') }), []);
  const infiltrator = normalizeInfiltrator(saveMirror.infiltrator, fallbackInfiltrator);
  const infiltratorIndex = INFILTRATOR_TYPES.indexOf(infiltrator);
  const cycleInfiltrator = (direction: -1 | 1) => save({ ...saveMirror, infiltrator: cycleRoster(INFILTRATOR_TYPES, infiltrator, direction) });

  return (
    <main className={`ds ds--${phase}`} lang={locale} data-build="chase-range-wall-v1">
      <DungeonScene ref={sceneRef} active={phase === 'playing'} runId={runId} dungeon={activeDungeon} infiltratorType={infiltrator} onHud={onHud} onFinish={onFinish} />
      <div className="ds__vignette" aria-hidden="true" />

      {phase === 'start' && <section className="ds-start" aria-labelledby="ds-title">
        <div className="ds-start__top"><div className="ds-start__kicker"><span />{t('kicker')}</div><h1 id="ds-title" aria-label={t('title')}><span>{t('brandTop')}</span><span>{t('brandBottom')}</span></h1><p>{t('subtitle')}</p></div>
        <div className="ds-start__dossier">
          <div className="ds-start__dossier-head"><span className="ds-start__seal"><RelicIcon /></span><span><small>{t('missionFile')}</small><strong>{SAMPLE_DUNGEON.name}</strong></span><button className="ds-start__rank" onPointerDown={() => setPhase('leaderboard')} aria-label={t('leaderboard')}>{t('rankShort')}</button></div>
          <p><span>{t('keeper')}</span><span>{t('expectedTime')}</span></p>
          <div className="ds-roster-select" role="group" aria-label={t('infiltrator')}><button type="button" disabled={!saveLoaded} onPointerDown={() => cycleInfiltrator(-1)} aria-label={t('previousCharacter')}><ArrowIcon/></button><span><small>{t('infiltrator')}</small><strong>{t(INFILTRATOR_NAME_KEYS[infiltrator])}</strong><i>{String(infiltratorIndex + 1).padStart(2, '0')}·{String(INFILTRATOR_TYPES.length).padStart(2, '0')}</i></span><button type="button" disabled={!saveLoaded} onPointerDown={() => cycleInfiltrator(1)} aria-label={t('nextCharacter')}><ArrowIcon/></button></div>
          <button className="ds-button ds-button--primary" onPointerDown={() => start(SAMPLE_DUNGEON, sampleAuthor)}><span>{t('raid')}</span><ArrowIcon /></button>
          <div className="ds-start__secondary"><button className="ds-button ds-button--secondary" disabled={!saveLoaded} onPointerDown={() => setPhase('builder')}>{t('build')}</button><button className="ds-button ds-button--secondary" disabled={!saveLoaded} onPointerDown={openArchive}><ArchiveIcon/><span>{saveLoaded ? t('archive') : t('loading')}</span></button></div>
        </div>
      </section>}

      {phase === 'builder' && <Builder number={saveMirror.totalBuilds + 1} onBack={home} onPublish={publishDungeon}/>} 
      {phase === 'archive' && <Archive community={wall.entries} mine={saveMirror.dungeons} loaded={wall.loaded} notice={archiveNotice} onBack={home} onBuild={() => { setArchiveNotice(''); setPhase('builder'); }} onRaid={(dungeon, author = sampleAuthor) => { setArchiveNotice(''); start(dungeon, author); }}/>} 
      {phase === 'leaderboard' && <RankPanel fetch={fetchLeaderboard} onClose={home}/>} 

      {phase === 'playing' && <><header className="ds-hud"><span className="ds-hud__run">{t('run')} {String(runId).padStart(3, '0')}</span><div className="ds-hud__stat"><small>{t('time')}</small><strong>{Math.ceil(hud.timeLeft).toString().padStart(2, '0')}</strong></div><div className={`ds-hud__loot ${hud.hasLoot ? 'is-held' : ''}`}><RelicIcon /><span>{hud.hasLoot ? t('stolen') : t('waiting')}</span></div><div className="ds-hud__lives" aria-label={`${t('lives')} ${hud.health}`}><small>{t('lives')}</small><strong>{String(hud.health).padStart(2, '0')}</strong></div><div className="ds-hud__alert"><span>{t('alert')}</span><div className="ds-hud__alert-track">{Array.from({ length: 8 }, (_, index) => <i key={index} className={hud.alert > index * 12.5 ? 'is-on' : ''} />)}</div></div></header><div className={`ds-objective ${hud.dashArmed ? 'is-dash' : ''} ${hud.hasLoot ? 'is-extract' : ''}`} role="status" aria-live={hud.hasLoot ? 'assertive' : 'polite'}>{hud.hasLoot ? <><ExitIcon/><span><strong>{t('extractTitle')}</strong><small>{t('extractHint')}</small></span></> : hud.dashArmed ? <span>{t('dashArmed')}</span> : <span className="ds-objective__guide"><strong>{t('moveHint')}</strong><small>{t('guardRule')}</small></span>}</div><div className="ds-actions"><button aria-label={t('smoke')} disabled={!hud.smokeReady} onPointerDown={() => sceneRef.current?.useSmoke()}><SmokeIcon /><span>{t('smoke')}<b>{hud.smokeReady ? t('ready') : t('used')}</b></span></button><button className={hud.dashArmed ? 'is-armed' : ''} aria-label={t('dash')} disabled={!hud.dashReady} onPointerDown={() => sceneRef.current?.armDash()}><DashIcon /><span>{t('dash')}<b>{hud.dashReady ? t('ready') : t('used')}</b></span></button></div></>}

      {(phase === 'won' || phase === 'lost') && result && <section className={`ds-result ${result.won ? 'is-win' : 'is-loss'}`} aria-live="polite"><span className="ds-result__stamp" aria-label={result.won ? t('stageClear') : t('runFailed')}>{result.won ? t('stageClearDisplay') : t('runFailedDisplay')}</span><div className="ds-result__mark">{result.won ? <RelicIcon /> : <LockIcon />}</div><h2 aria-label={result.won ? t('win') : t('lose')}>{result.won ? t('winDisplay') : t('loseDisplay')}</h2>{!result.won && <p className="ds-result__reason">{resultReason}</p>}<div className="ds-result__meta"><p className="ds-result__eyebrow">{activeDungeon.name}</p><div className="ds-result__author"><span>{t('by')}</span><ResultAuthor author={activeAuthor}/></div></div><div className="ds-result__score"><span>{t('score')}</span><strong>{result.score.toLocaleString()}</strong></div><div className="ds-result__metrics"><span><small>{t('time')}</small><strong>{Math.ceil(result.timeLeft)}s</strong></span><span><small>{t('health')}</small><strong>{result.health}/3</strong></span><span><small>{t('alarms')}</small><strong>{result.alarms}</strong></span></div><button className="ds-button ds-button--primary" onPointerDown={() => start()}><span>{t('again')}</span><ArrowIcon /></button><button className="ds-button ds-button--secondary" onPointerDown={openArchive}>{t('next')}</button><button className="ds-result__next" onPointerDown={home}>{t('home')}</button></section>}
      <div className="ds__brand" aria-hidden="true"><img src={aigramSrc} alt="" draggable={false} /><span>BUILD R2</span></div>
    </main>
  );
}
