// Fixed application constants. No configuration or stretch features (A-1).

import type { ManorStageId } from './types.ts';

/** Number of Tasks to complete per local day. Fixed and not configurable (A-1). */
export const DAILY_GOAL = 3;

/** Highest Schema_Version this build can read and write (AC-PERS-01.3). */
export const SCHEMA_VERSION = 1;

/** The single namespaced key for the Storage_Envelope (AC-PERS-01.4). */
export const STORAGE_KEY = 'spectral-tasks:data';

/** Separate key where a raw corrupted value is backed up (AC-PERS-02.4). */
export const BACKUP_KEY = 'spectral-tasks:data:corrupted-backup';

/** Maximum trimmed title length (AC-VAL-01.2). */
export const MAX_TITLE_LENGTH = 100;

/** Maximum description length (AC-VAL-01.3). */
export const MAX_DESCRIPTION_LENGTH = 1000;

/** Inclusive bounds for the estimated duration in minutes (AC-VAL-01.5). */
export const MIN_ESTIMATED_MINUTES = 1;
export const MAX_ESTIMATED_MINUTES = 1440;

/** A single Manor_Stage definition. */
export interface ManorStage {
  id: ManorStageId;
  /** Stage name shown on the Dashboard (AC-MANOR-01.2). */
  name: string;
  /** Lowest Completed_Task count that maps to this stage (AC-MANOR-01.2). */
  min: number;
  /** Text alternative describing the manor at this stage (AC-MANOR-01.10). */
  description: string;
}

/**
 * Completed_Task count thresholds mapped to named Manor_Stages (AC-MANOR-01.2):
 * 0 -> Abandoned, 1-4 -> Awakening, 5-9 -> Stirring, 10-19 -> Illuminated,
 * 20-34 -> Restored, 35+ -> Enchanted.
 */
export const MANOR_STAGES: readonly ManorStage[] = [
  {
    id: 0,
    name: 'Abandoned',
    min: 0,
    description: 'A ruined, dark manor shrouded in gloom, its windows empty and its grounds overgrown.',
  },
  {
    id: 1,
    name: 'Awakening',
    min: 1,
    description: 'The manor stirs from slumber as faint light flickers behind cracked windows.',
  },
  {
    id: 2,
    name: 'Stirring',
    min: 5,
    description: 'Walls stand firmer and a warm glow spreads through several restored rooms.',
  },
  {
    id: 3,
    name: 'Illuminated',
    min: 10,
    description: 'Many windows shine brightly and the grounds begin to clear of fog.',
  },
  {
    id: 4,
    name: 'Restored',
    min: 20,
    description: 'The manor is largely rebuilt, with lanterns lit and gardens coming back to life.',
  },
  {
    id: 5,
    name: 'Enchanted',
    min: 35,
    description: 'A fully restored, radiant manor glowing with warmth and spectral light.',
  },
] as const;
