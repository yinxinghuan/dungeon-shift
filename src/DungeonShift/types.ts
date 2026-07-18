export type Phase = 'start' | 'builder' | 'archive' | 'playing' | 'won' | 'lost' | 'leaderboard';

export interface Cell { c: number; r: number }
export type TrapType = 'spike' | 'rune';
export type BuilderTool = 'wall' | TrapType | 'guard' | 'erase';
export type InfiltratorType = 'shopkeeper' | 'granny' | 'oldman' | 'blonde' | 'kid' | 'businessman' | 'officeWoman' | 'student' | 'darkWoman' | 'worker' | 'teen' | 'fitWoman' | 'chef' | 'bigGuy';
export type GuardType = 'vampire' | 'werewolf' | 'zombie' | 'ghost' | 'skeleton' | 'mummy';

export interface TrapSpec {
  id: string;
  type: TrapType;
  cell: Cell;
}

export interface GuardSpec {
  id: string;
  type: GuardType;
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
  infiltrator?: InfiltratorType;
  _lastActive?: number;
}

export interface DungeonAuthor {
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
}

export interface WallEntry extends DungeonAuthor {
  dungeon: DungeonConfig;
  plays?: number;
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
