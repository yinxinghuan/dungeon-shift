import { useCallback, useEffect, useState } from 'react';
import { callAigramAPI, isInAigram, type AigramResponse } from '@shared/runtime/bridge';
import { getGameUuid } from '@shared/runtime/game-id';
import type { DungeonSave, WallEntry } from '../types';

interface SaveRow { user_id: string; resource_data?: string }

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
            for (const dungeon of save.dungeons || []) {
              if (dungeon?.id && dungeon.version === 1) pairs.push({ userId: String(row.user_id), dungeon });
            }
          } catch { /* skip malformed saves */ }
        }
        pairs.sort((a, b) => b.dungeon.createdAt - a.dungeon.createdAt);
        const limited = pairs.slice(0, 24);
        const profiles = await Promise.all([...new Set(limited.map((item) => item.userId))].map(async (userId) => {
          try {
            const profile = await callAigramAPI<AigramResponse<{ name?: string; head_url?: string }>>(
              `/note/telegram/user/get/info/by/telegram_id?telegram_id=${encodeURIComponent(userId)}`,
            );
            return [userId, profile.data] as const;
          } catch { return [userId, null] as const; }
        }));
        const profileMap = new Map(profiles);
        if (!cancelled) setEntries(limited.map(({ userId, dungeon }) => ({
          userId, dungeon,
          userName: profileMap.get(userId)?.name,
          userAvatarUrl: profileMap.get(userId)?.head_url,
        })));
      } catch { if (!cancelled) setEntries([]); }
      finally { if (!cancelled) setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [nonce]);

  return { entries, loaded, refresh };
}
