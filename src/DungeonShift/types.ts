export type Phase = 'start' | 'builder' | 'archive' | 'playing' | 'won' | 'lost' | 'leaderboard';

export interface Cell { c: number; r: number }
export type TrapType = 'spike' | 'rune';
export type BuilderTool = 'wall' | TrapType | 'guard' | 'erase';

export interface TrapSpec {
  id: string;
  type: TrapType;
  cell: Cell;
}

export interface GuardSpec {
  id: string;
  type: 'vampire';
  route: Cell[];
}

export interface DungeonConfig {
  id: string;
  version: 1;
  name: string;
  createdAt: number;
  blocked: Cell[];
  traps: TrapSpec[];
  guards: GuardSpec[];
  budgetUsed: number;
}

export interface DungeonSave {
  dungeons: DungeonConfig[];
  totalBuilds: number;
  bestScore: number;
  _lastActive?: number;
}

export interface DungeonAuthor {
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
}

export interface WallEntry extends DungeonAuthor {
  dungeon: DungeonConfig;
}

export interface HudState {
  timeLeft: number;
  health: number;
  alert: number;
  hasLoot: boolean;
  smokeReady: boolean;
  dashReady: boolean;
  dashArmed: boolean;
  alarms: number;
}

export interface RunResult extends HudState {
  won: boolean;
  score: number;
  reason: 'escaped' | 'caught' | 'timeout';
}

export interface DungeonSceneHandle {
  useSmoke: () => void;
  armDash: () => void;
}
