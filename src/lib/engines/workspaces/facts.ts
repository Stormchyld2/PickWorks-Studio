/**
 * Turns the access facts the native core sends a signed-in student into the
 * access engine's input (Workspace Navigation, Stage B). Pure and tested.
 */
import type { StudentWorkspaceAccess } from '$lib/services/core-client';
import { isWorkspaceId, type WorkspaceId } from './config';
import { thresholdFromPercent, workspaceAccess, type LevelCoverage, type WorkspaceAccess } from './access';

/**
 * Lesson coverage by level. No curriculum with levelled lessons exists yet
 * (Phase 2), so both levels have no lessons and Automatic Learning Unlock
 * cannot fire. The curriculum engine replaces this when it is built.
 */
export const NO_LESSONS: { beginner: LevelCoverage; intermediate: LevelCoverage } = {
  beginner: { covered: 0, total: 0 },
  intermediate: { covered: 0, total: 0 },
};

/** Access for every workspace; null when the facts aren't loaded. Throws on invalid settings. */
export function accessFrom(
  facts: StudentWorkspaceAccess | null,
  shown: Partial<Record<WorkspaceId, boolean>>,
  coverage = NO_LESSONS,
): WorkspaceAccess[] | null {
  if (!facts) return null;
  return workspaceAccess({
    admin: {
      unlockAll: facts.unlockAll,
      automaticLearningUnlock: facts.automaticLearningUnlock,
      thresholds: {
        beginnerLessons: thresholdFromPercent(facts.beginnerLessonsPercent),
        intermediateLessons: thresholdFromPercent(facts.intermediateLessonsPercent),
      },
    },
    studentGrants: facts.grants.filter(isWorkspaceId),
    coverage,
    shown,
  });
}
