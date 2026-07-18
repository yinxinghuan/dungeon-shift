import type { CopyKey } from './i18n';
import type { GuardType, InfiltratorType } from './types';

export const INFILTRATOR_TYPES = [
  'shopkeeper', 'granny', 'oldman', 'blonde', 'kid', 'businessman', 'officeWoman',
  'student', 'darkWoman', 'worker', 'teen', 'fitWoman', 'chef', 'bigGuy',
] as const satisfies readonly InfiltratorType[];

export const GUARD_TYPES = [
  'vampire', 'werewolf', 'zombie', 'ghost', 'skeleton', 'mummy',
] as const satisfies readonly GuardType[];

export const INFILTRATOR_NAME_KEYS: Record<InfiltratorType, CopyKey> = {
  shopkeeper: 'characterShopkeeper', granny: 'characterGranny', oldman: 'characterOldman',
  blonde: 'characterBlonde', kid: 'characterKid', businessman: 'characterBusinessman',
  officeWoman: 'characterOfficeWoman', student: 'characterStudent', darkWoman: 'characterDarkWoman',
  worker: 'characterWorker', teen: 'characterTeen', fitWoman: 'characterFitWoman',
  chef: 'characterChef', bigGuy: 'characterBigGuy',
};

export const GUARD_NAME_KEYS: Record<GuardType, CopyKey> = {
  vampire: 'guardVampire', werewolf: 'guardWerewolf', zombie: 'guardZombie',
  ghost: 'guardGhost', skeleton: 'guardSkeleton', mummy: 'guardMummy',
};

export function normalizeInfiltrator(value: unknown, fallback: InfiltratorType = 'teen'): InfiltratorType {
  return INFILTRATOR_TYPES.includes(value as InfiltratorType) ? value as InfiltratorType : fallback;
}

export function normalizeGuardType(value: unknown, fallback: GuardType = 'vampire'): GuardType {
  return GUARD_TYPES.includes(value as GuardType) ? value as GuardType : fallback;
}

export function stableInfiltratorFor(seed: string): InfiltratorType {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return INFILTRATOR_TYPES[(hash >>> 0) % INFILTRATOR_TYPES.length];
}

export function guardTypeForBuild(number: number): GuardType {
  return GUARD_TYPES[Math.max(0, number - 1) % GUARD_TYPES.length];
}

export function cycleRoster<T extends string>(items: readonly T[], current: T, direction: -1 | 1): T {
  const currentIndex = Math.max(0, items.indexOf(current));
  return items[(currentIndex + direction + items.length) % items.length];
}
