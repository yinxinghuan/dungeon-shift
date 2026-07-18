export type Locale = 'zh' | 'en';

function detectLocale(): Locale {
  const override = localStorage.getItem('game_locale');
  if (override === 'en' || override === 'zh') return override;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export const locale = detectLocale();

const copy = {
  zh: {
    kicker: '异步潜入实验场', title: '地牢换班', brandTop: 'DUNGEON', brandBottom: 'SHIFT',
    subtitle: '偷走宝物。躲过守卫。活着回到青色入口。', missionFile: '任务档案', expectedTime: '预计潜入时间：75 秒', rankShort: '排名 --',
    raid: '潜入样板地牢', build: '设计你的地牢', archive: '挑战地牢档案', leaderboard: '高手榜',
    guide: '点击相邻地格移动。红色视线就是敌人面朝的方向；夺宝后跟随青色箭头撤离。',
    sample: '样板地牢', keeper: '守关者：地牢档案员',
    time: '剩余', loot: '宝物', alert: '警戒', smoke: '烟雾', dash: '冲刺', run: 'RUN', ready: '就绪', used: '已使用',
    steal: '宝物到手 · 跟随青色箭头返回入口', enter: '点击相邻地格 · 双指缩放 · 前往宝库', extractTitle: '宝物到手，立即撤离', extractHint: '跟随青色箭头 · 返回入口地格',
    dashArmed: '选择相邻地格，冲刺将越过两格',
    win: '干净撤离', lose: '潜入失败', winDisplay: 'CLEAN GETAWAY', loseDisplay: 'RUN FAILED', stageClear: '行动成功', runFailed: '行动失败', stageClearDisplay: 'STAGE CLEAR', runFailedDisplay: 'RUN FAILED',
    caught: '你被守卫截住了', timeout: '地牢封锁前未能撤离',
    score: '本次得分', health: '剩余生命', alarms: '触发警报',
    again: '再潜一次', home: '返回档案室', next: '挑战别人的地牢',
    stolen: '已取得', waiting: '未取得', lives: '生命',
    back: '返回', keeperMode: '地牢主模式', builderTitle: '布置伏击', builderDisplay: 'SET THE AMBUSH', builderBrief: '花费 12 点预算布置守卫与机关，同时保留入口到宝库的通路。',
    entrance: '入口', vault: '宝库', template: '套用样板', tools: '建造工具', wall: '石墙', spike: '尖刺', rune: '警报符文', guard: '守卫', erase: '清除',
    budgetLeft: '点剩余', builderFixed: '入口与宝库不能修改。', builderBudgetError: '预算不足，先清除一项设施。', builderGuardError: '守卫需要一格相邻巡逻空间。', builderNeedGuard: '至少布置一名守卫。', builderPathError: '石墙封死了通路，请留出一条可行路线。', builderReady: '路线可通行，可以发布。', builderHint: '布置至少一名守卫，并保持路线连通。', publish: '发布地牢', shift: 'SHIFT', published: '地牢已进入挑战档案',
    archiveKicker: '异步挑战档案', archiveTitle: '选择一位守关者', archiveDisplay: 'CHOOSE A KEEPER', archiveBrief: '每座地牢都由另一位玩家留下。成功撤离会登上高手榜，也会把结果送回作者。', mine: '我的地牢', community: '社区挑战', emptyArchive: '还没有玩家地牢。先发布一座，或挑战样板地牢。', loading: '读取档案…', raidThis: '潜入', by: '守关者', you: '你', sampleKeeper: '地牢档案员', getAlterU: '下载 AlterU 查看社区地牢',
    rankTitle: '高手榜', rankDisplay: 'LEADERBOARD', rankBrief: '只记录每位潜入者的最高成功分数。', noRanks: '还没有成功撤离记录。', close: '关闭', champion: '当前冠军', openAlterURank: '在 AlterU 中打开即可查看完整高手榜。', getAlterURank: '下载 AlterU 查看高手榜',
    notified: '结果已送回地牢主',
  },
  en: {
    kicker: 'ASYNC INFILTRATION LAB', title: 'DUNGEON SHIFT', brandTop: 'DUNGEON', brandBottom: 'SHIFT',
    subtitle: 'Steal the relic. Evade the guards. Make it back to the cyan entry.', missionFile: 'MISSION FILE', expectedTime: 'Estimated run: 75 seconds', rankShort: 'RANK --',
    raid: 'INFILTRATE SAMPLE', build: 'DESIGN YOUR DUNGEON', archive: 'RAID THE ARCHIVE', leaderboard: 'LEADERBOARD',
    guide: 'Tap an adjacent tile. Red sight matches the guard’s face. Follow the cyan arrow home after the relic.',
    sample: 'Sample dungeon', keeper: 'Keeper: The Archivist',
    time: 'TIME', loot: 'LOOT', alert: 'ALERT', smoke: 'SMOKE', dash: 'DASH', run: 'RUN', ready: 'READY', used: 'USED',
    steal: 'RELIC SECURED · FOLLOW THE CYAN ARROW HOME', enter: 'TAP TO MOVE · PINCH TO ZOOM · REACH THE VAULT', extractTitle: 'RELIC SECURED — EXTRACT', extractHint: 'FOLLOW THE CYAN ARROW TO THE ENTRY TILE',
    dashArmed: 'Choose an adjacent tile to dash across two spaces.',
    win: 'CLEAN GETAWAY', lose: 'INFILTRATION FAILED', winDisplay: 'CLEAN GETAWAY', loseDisplay: 'RUN FAILED', stageClear: 'STAGE CLEAR', runFailed: 'RUN FAILED', stageClearDisplay: 'STAGE CLEAR', runFailedDisplay: 'RUN FAILED',
    caught: 'A guard stopped your run.', timeout: 'The dungeon sealed before you escaped.',
    score: 'SCORE', health: 'HEALTH', alarms: 'ALARMS',
    again: 'RUN IT AGAIN', home: 'BACK TO ARCHIVE', next: 'RAID ANOTHER KEEPER',
    stolen: 'SECURED', waiting: 'MISSING', lives: 'LIVES',
    back: 'Back', keeperMode: 'KEEPER MODE', builderTitle: 'SET THE AMBUSH', builderDisplay: 'SET THE AMBUSH', builderBrief: 'Spend 12 points on guards and traps while preserving a route from entrance to vault.',
    entrance: 'Entrance', vault: 'Vault', template: 'Use sample', tools: 'Builder tools', wall: 'Wall', spike: 'Spikes', rune: 'Alarm', guard: 'Guard', erase: 'Erase',
    budgetLeft: 'PTS LEFT', builderFixed: 'The entrance and vault are fixed.', builderBudgetError: 'Not enough budget. Erase a fixture first.', builderGuardError: 'A guard needs one adjacent patrol tile.', builderNeedGuard: 'Place at least one guard.', builderPathError: 'The walls seal the route. Leave one path open.', builderReady: 'Route verified. Ready to publish.', builderHint: 'Place a guard and keep the route connected.', publish: 'PUBLISH DUNGEON', shift: 'SHIFT', published: 'Dungeon added to the raid archive.',
    archiveKicker: 'ASYNC RAID ARCHIVE', archiveTitle: 'CHOOSE A KEEPER', archiveDisplay: 'CHOOSE A KEEPER', archiveBrief: 'Every dungeon was left by another player. Escape to rank—and send the result back to its maker.', mine: 'MY DUNGEONS', community: 'COMMUNITY RAIDS', emptyArchive: 'No player dungeons yet. Publish one or raid the sample.', loading: 'Reading archive…', raidThis: 'RAID', by: 'Keeper', you: 'YOU', sampleKeeper: 'The Archivist', getAlterU: 'GET ALTERU FOR COMMUNITY DUNGEONS',
    rankTitle: 'LEADERBOARD', rankDisplay: 'LEADERBOARD', rankBrief: 'Only each infiltrator’s highest successful score is kept.', noRanks: 'No clean getaways yet.', close: 'Close', champion: 'CURRENT CHAMPION', openAlterURank: 'Open in AlterU to see the full leaderboard.', getAlterURank: 'GET ALTERU FOR LEADERBOARDS',
    notified: 'Result delivered to the keeper.',
  },
} as const;

export type CopyKey = keyof typeof copy.zh;
export function t(key: CopyKey): string { return copy[locale][key]; }
