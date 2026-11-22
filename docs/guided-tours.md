# Guided tours (architecture, approved 2026-11-22)

Status: **documented only**. Nothing here is built until Jason explicitly authorises it (planned for Phase 2).

## What a tour looks like

The approved presentation stays as designed:

- The interface element being explained is highlighted.
- A short balloon popup is anchored to it, with **Back**, **Next**, **Skip Tour** and **Learn More**.
- **Learn More** opens a modal with the full explanation of that feature. Closing the modal returns the student to the same step.
- Layout follows the shared breakpoints. On Windows and Android tablets the balloon anchors beside the element. On phones it docks above or below the element so it never covers it.

No redesign of existing screens is part of this work.

## One tour per workspace

| Tour id | Workspace | Launches automatically |
| --- | --- | --- |
| `learning-studio` | Learning Studio (main orientation) | Once, on the student's first-ever sign-in |
| `play-create` | Play & Create | Once, on the student's first visit to that workspace |
| `reference` | Reference | Once, on the student's first visit to that workspace |

Each tour launches automatically only when all of these are true:

1. Its status for this student is "never shown".
2. Its workspace is implemented and the student can open it (progression unlock or Unlock All Workspaces; see the workspace plan).
3. The workspace is not hidden in "Show in Workspace Dropdown".
4. The student is actually in that workspace (first sign-in for Learning Studio, first visit for the others).

A student who unlocks Play & Create or Reference manually gets that workspace's tour on their first visit only. A hidden workspace's tour never launches.

## Skipping and restarting

- Any tour can be skipped at any step, with no restrictions. Skipping sets the status to "skipped", so it won't launch automatically again.
- Finishing the last step sets the status to "completed".
- Help and Settings list every tour whose workspace is available. A student can restart any of them at any time, from the start or from the last step reached.
- Restarting a tour never changes lesson progress, XP, achievements or mastery. Tours never write to those records.

## Per-student tracking

Stored in each student's own folder as a versioned record (`tutorials`), like preferences:

```json
{
  "schemaVersion": 1,
  "data": {
    "learning-studio": { "status": "completed", "lastStep": 7, "contentVersion": 1, "updatedAt": "2026-..." },
    "play-create": { "status": "never", "lastStep": 0, "contentVersion": 0, "updatedAt": null }
  }
}
```

- `status`: `never` | `completed` | `skipped`.
- `lastStep`: the step reached, for optional manual resume.
- `contentVersion`: the version of the tour the student saw.

A tour that is completed or skipped is **never** launched automatically again, even if the app is updated, the tour content changes or new features are added. A newer `contentVersion` may show a small "What's new" note in Help, but it never re-launches the tour.

The record is included in student and installation backups and restores like every other student file. Administrators can't edit it, and changing installation defaults doesn't touch it.

## Steps describe only real features

Each step declares the feature it explains (for example `feature: "fretboard-explorer.chords"`). The tour engine shows a step only if that feature is implemented and visible to the student at that moment. Steps for unavailable features are skipped, and no step presents a future feature as working. Step text is reviewed with each release like any other student-facing wording.

## Where it lives in the code (planned)

- `engines/tours/` (pure, tested): tour definitions, `shouldAutoLaunch(tour, record, access)` and `visibleSteps(tour, features)`.
- `stores/tours.svelte.ts`: loads and saves the `tutorials` record and starts tours.
- `components/tour/`: highlight, balloon and Learn More modal, shared by every platform.

## Tests (planned)

- Auto-launch happens exactly once per student per tour, and never after "completed" or "skipped", including after a `contentVersion` bump.
- No auto-launch for unimplemented, locked or hidden workspaces. A manually unlocked workspace launches its tour on the first visit only.
- Steps for unavailable features are dropped.
- Learn More returns to the same step.
- Restarting a tour leaves lessons, XP, achievements and mastery unchanged.
- Two students on one installation have independent tour records.
