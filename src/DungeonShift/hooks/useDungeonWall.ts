import { useCallback, useEffect, useState } from 'react';
import { callAigramAPI, isInAigram, type AigramResponse } from '@shared/runtime/bridge';
import { getGameUuid } from '@shared/runtime/game-id';
import type { DungeonSave, WallEntry } from '../types';
import { dungeonPlayEvent, normalizeDungeon, validateDungeon } from '../dungeons';

interface SaveRow { user_id: string; resource_data?: string }
interface PlayStats { total_click_count?: number }

export function useDungeonWall() {
  const [entries, setEntries] = useState<WallEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const sessionId = getGameUuid();
    if (!isInAigram || !sessionId) { setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const response = await callAigramAPI<AigramResponse<SaveRow[]>>(
          `/note/aigram/ai/game/get/data/list?session_id=${encodeURIComponent(sessionId)}`,
        );
        const rows = Array.isArray(response?.data) ? response.data : [];
        const pairs: Array<{ userId: string; dungeon: DungeonSave['dungeons'][number] }> = [];
        for (const row of rows) {
          if (!row.user_id || !row.resource_data) continue;
          try {
            const save = JSON.parse(row.resource_data) as DungeonSave;
            for (const rawDungeon of save.dungeons || []) {
              const dungeon = normalizeDungeon(rawDungeon);
              if (dungeon && validateDungeon(dungeon).code === 'ready') pairs.push({ userId: String(row.user_id), dungeon });
            }
          } catch { /* skip malformed saves */ }
        }
        pairs.sort((a, b) => b.dungeon.createdAt - a.dungeon.createdAt);
        const limited = pairs.slice(0, 24);
        const basicEntries: WallEntry[] = limited.map(({ userId, dungeon }) => ({ userId, dungeon }));
        if (!cancelled) { setEntries(basicEntries); setLoaded(true); }
        const [profiles, playCounts] = await Promise.all([
          Promise.all([...new Set(limited.map((item) => item.userId))].map(async (userId) => {
          try {
            const profile = await callAigramAPI<AigramResponse<{ name?: string; head_url?: string }>>(
              `/note/telegram/user/get/info/by/telegram_id?telegram_id=${encodeURIComponent(userId)}`,
            );
            return [userId, profile.data] as const;
          } catch { return [userId, null] as const; }
          })),
          Promise.all([...new Set(limited.map((item) => item.dungeon.id))].map(async (dungeonId) => {
            try {
              const stats = await callAigramAPI<AigramResponse<PlayStats>>(
                `/note/aigram/ai/game/get/play/stats?session_id=${encodeURIComponent(sessionId)}&event=${encodeURIComponent(dungeonPlayEvent(dungeonId))}`,
              );
              return [dungeonId, Math.max(0, Number(stats.data?.total_click_count) || 0)] as const;
            } catch { return [dungeonId, 0] as const; }
          })),
        ]);
        const profileMap = new Map(profiles);
        const playCountMap = new Map(playCounts);
        if (!cancelled) setEntries(limited.map(({ userId, dungeon }) => ({
          userId, dungeon,
          userName: profileMap.get(userId)?.name,
          userAvatarUrl: profileMap.get(userId)?.head_url,
          plays: playCountMap.get(dungeon.id) ?? 0,
        })));
      } catch { /* Preserve the optimistic/local wall when the platform is temporarily unavailable. */ }
      finally { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [nonce]);

  return { entries, loaded, refresh };
}
