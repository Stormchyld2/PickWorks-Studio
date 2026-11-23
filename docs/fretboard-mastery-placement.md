# Fretboard Mastery: placement, directed progression and dashboard contract

**Status:** Approved product behavior, documented 2026-11-22. **Implementation:** Owner subsequently authorised Wave 1 assessment/placement engine development and its prerequisite contracts, persistence and tests; the full placement wizard and other UI wiring remain later work. This document is the design-detail source for placement and progression; [master-roadmap.md](master-roadmap.md) controls scheduling and [requirements-v1.md](requirements-v1.md) controls the locked note-mastery rule.

## Purpose and boundaries

Fretboard Mastery is a **directed curriculum** with an individually placed starting point. The dashboard is a **continuously evolving progress and navigation block**, **not a lesson or drill surface**. The actual instruction, fretboard interactions, questions, assessments and feedback belong in Learn/Practice/Fretboard lesson experiences. The dashboard presents the student's current lesson, recommended next action, progress and review needs, with a link to resume the appropriate lesson. Do not show an invented lesson, progress percentage or completed mission before real data exists.

Students may freely revisit **any earlier unlocked lesson**, including lessons below their placement, but **may not jump forward beyond their current unlocked progression**. A future lesson remains locked until its prerequisite gate is satisfied. A learner can explore notes, strings and musical keys independently in Fretboard Explorer without changing the directed curriculum's gates.

## First-time per-student Skill Placement Wizard

- Show after first successful student-account setup/sign-in, before the first normal dashboard. It belongs to each student, not the installation or administrator. Existing students require a safe migration/default path.
- Keep it brief, accessible and ADHD-friendly. Begin with three universal, unscored background questions: (1) playing experience, (2) comfortable skills across chords/songs/rhythm/scales/note navigation, and (3) learning goals. Use these answers to choose appropriate assessment items, **not** to grant unlocks. Distinguish note-finding, string familiarity, octave patterns, intervals and key knowledge; playing years and chord fluency are not equivalent to fretboard knowledge.
- New players can choose **Start with fundamentals** without testing. Other students may take a short, practical **placement assessment** using the existing lesson/performance/mastery evaluation architecture. Do not use theory trivia alone.
- Provide an understandable recommended starting lesson and an explanation of the evidence. Do not attach permanent Beginner/Intermediate/Advanced labels to the student.
- A skipped or interrupted assessment must not grant advancement. Allow a later reassessment; never erase existing achievements, earned mastery or prior attempts. Placement is per curriculum and per student, not global.
- Do not promise that a 3–5 minute assessment can certify every advanced skill: use adaptive sampling and mark unverified prerequisites as needing a targeted check. Use approximately 5–12 adaptive practical prompts after the three universal questions; allow more if evidence is inconclusive. Select subsequent prompts based on prior responses, check isolated errors with equivalent alternate items, and evaluate fretboard skills independently of unrelated chord/rhythm weaknesses. Exact assessment items, pass criteria and maximum placement leap require a separate Phase 2 design and tests before implementation.

## Placement, access and mastery are separate concepts

- **Placement** identifies the first recommended directed lesson, based on observed evidence or the student's choice to start at the beginning.
- **Unlocked access** means a lesson is available. At initial placement, all preceding lessons and the placed lesson are unlocked; subsequent lessons are locked. Earlier lessons remain accessible for review.
- **Mastery** is earned only by the approved mastery engine and evidence rules. Placement does **not** automatically grant note mastery, XP, completed missions or fabricated lesson-completion history.
- **Progression gate:** successful completion of the current stage's defined prerequisites opens the next directed lesson. Never allow manual selection to bypass a locked gate. An explicit reassessment can establish a higher placement by verifying the relevant prerequisite evidence, without awarding mastery for skipped material.
- **Exploration:** allow choosing a note, a string, or a musical **key** as separate study targets; a note and a key are not interchangeable. Exploration is independent of directed lesson advancement and cannot silently unlock a stage.
- **Review:** previously unlocked lessons remain available even when accuracy later declines; recommend review rather than relocking earned access.

The existing locked **note-mastery rule** remains unchanged: most recent 10 attempts per note, at least 90% qualifying independent correct responses under 3 seconds, with qualifying answers on at least two distinct days; see [requirements-v1.md](requirements-v1.md). Placement assessment qualification and stage progression are separate decisions and must not be misrepresented as note mastery. Define their specific evidence gates during Phase 2 without weakening the note-mastery rule.

## Adaptive Skill Assessment & Placement Engine

**Approved design direction (2026-11-22):** Build a reusable pure-TypeScript assessment/placement engine in Phase 2, integrating the existing lessons, practice, performance and mastery engines rather than duplicating them.

- **Skill model:** Track evidence independently for anchor notes, across-string note recognition, octave navigation, intervals and practical key/root application. Collect chord fluency, rhythm, songs and playing experience as optional background dimensions, not automatic fretboard placement penalties or unlock credits.
- **Selection:** Three identical initial background questions for every student; then an adaptive item selector chooses practical tasks from a tagged, validated item bank by skill, difficulty and prerequisites. The question selector should sample both likely strengths and gaps and confirm unexpected misses. No single item decides an entire stage.
- **Evidence:** Store skill ID, item ID/version, context, response, correctness, reveal/help status, response time where applicable and timestamp. Do not use speed alone as a placement gate. A familiarization interaction is unscored. Assessment results are distinct from normal practice attempts and note-mastery events.
- **Placement decision:** Recommend the highest curriculum entry point for which **all required prerequisites have sufficient independent evidence**. Missing or conflicting evidence triggers targeted follow-up or conservative placement with an explanation, not an invented score. A student's self-reported ability alone never unlocks.
- **Output:** A per-skill evidence profile, confidence/coverage indicators, recommended starting lesson, verified prerequisite set, unlocked curriculum frontier and plain-language reasons. This is a living profile; later practice and reassessments can refine recommendations while preserving earned access.
- **Assessment controls:** Adaptive sessions have bounded length, no silent guessing, alternate items for reassessment and interruption-safe persistence. An unfinished placement awards no new unlocks.
- **Separation:** Do not equate assessment placement with completion, note mastery or XP. Do not change the approved rolling-window note-mastery algorithm.

## Administrator override: Open All Lessons

The administrator may grant **Open All Lessons** for an individual student and curriculum if placement misses their ability. This is an **access override only**, not a change to placement evidence, mastered notes, XP, achievements, completion records or assessment results.

- Admin Student Management shows the student's normal placement/frontier and whether an override is active. Granting and revoking require an explicit confirmation and are audited with administrator identity, student ID, action, timestamp and optional reason.
- The authorization must be enforced in the same Rust-owned student access path as other privileged operations; students cannot activate it through UI state, route parameters or edited client payloads.
- With an active override, all directed lessons in the selected curriculum are accessible. **Earlier lessons remain accessible in every mode.** Revoking the override returns access to the student's highest legitimately earned/verified frontier without deleting progress completed while the override was active. Define how those completed lessons contribute to subsequent prerequisites before implementation.
- Overrides are per student and per curriculum, not global; they survive sign-out/restart and appear in backup/restore under the normal student-data rules. Never leak one student's override to another.
- Future lessons remain locked for students **without** an active override, except when earned progression or verified reassessment legitimately advances their frontier.
- The UI should clearly label an override as "Opened by administrator" rather than "Mastered."
- **Naming:** this lesson-access override is called **Open All Lessons** everywhere (UI, audit actions, code). It is a different control from the workspace setting **Unlock All Workspaces** (Workspace Navigation plan), which changes which workspaces are available and never changes lesson access; neither control implies the other.

## Workspace unlock and placement (resolved 2026-11-23)

**The gap:** Automatic Learning Unlock opens the other workspaces when a student has completed 80% of Beginner and 50% of Intermediate lessons (thresholds configurable in the curriculum). Placement never records completions for skipped lessons, so a student placed ahead would never reach the threshold, however much they can demonstrably do.

**Rule:** the threshold counts **covered** lessons, not only completed ones. A lesson is covered when either:

1. the student **completed** it through its normal gate, or
2. the student's **verified placement or reassessment evidence** satisfies every prerequisite skill that lesson teaches (the same evidence that let the placement engine start them beyond it).

Not covered:

- lessons opened only through **Open All Lessons** (access is not evidence);
- lessons the student merely viewed or explored;
- self-reported ability.

**Covered is a derived value**, computed by the curriculum engine from completions and the placement evidence. It is never written as a completion, and it never awards XP, missions, achievements or note mastery. The Progress screen may show "Covered by placement" next to such lessons, distinct from "Completed".

**Effects on existing behaviour:**

- Automatic Learning Unlock still never touches XP, lessons or mastery, as the workspace plan requires.
- An administrator can still use Unlock All Workspaces or a per-student workspace override regardless of coverage.
- If evidence later declines, already-unlocked workspaces stay unlocked. Workspace unlocks are never taken back automatically, matching the "recommend review, never relock earned access" rule above.

## Storage and enforcement (approved by the Project Owner, 2026-11-23)

**Principle: store facts, derive access.** No stored list of unlocked lessons exists to drift, contradict or be restored out of date. Access is always computed from three kinds of stored facts:

| Fact | Where it lives | Written by | Format |
| --- | --- | --- | --- |
| Assessment observations (placement and reassessment answers, with item id and version) | Student folder: `placement-evidence.jsonl` | The student's own session, through the existing Rust `append_log` ownership path | Append-only log (crash-safe since Fix 1) |
| Lesson completions | Student folder: existing progress records and logs | The student's own session | Existing records |
| Placement result snapshot (verified prerequisite set, recommended start, engine and curriculum version) | Student folder: `placement` record | The student's own session | Versioned JSON; recomputable from the evidence, kept for speed and explanation |
| **Open All Lessons** grants | `accounts/lesson-access.json` (installation data, next to the account index) | Rust core, administrator session only | Versioned JSON: student id, curriculum id, granted and revoked times; every change audited |

**Why the override does not live in the student's folder:**

- The administrator never needs a new write path into a student's records. Student data isolation stays exactly as it is, with no new privileged read or write path to security-review.
- A **student backup restore cannot bring back a revoked override**, because student backups contain only the student folder. An installation restore brings back grants together with the accounts they belong to, which is consistent.
- Students can read their own grants through a narrow Rust command, but never write them.
- Deleting a student removes their grants in the same operation.

**Who enforces what:**

- **Rust core:** student data isolation, and administrator-only writes to the grant file (both are security boundaries).
- **One TypeScript curriculum engine:** computes the lesson frontier from evidence + completions + grants. Lesson gates are pedagogy, not security: the student owns their machine and data. They must still never be bypassable through the app (route guards and the lesson runner both ask the engine).
- **Gate logic stays out of Rust** so there is exactly one implementation, keeping the "no duplicate engines" rule.

**Migration:**

- Existing students have no evidence and no placement record. They start at fundamentals with earlier progress intact.
- The wizard is offered once, on their next sign-in, and can be skipped.
- Nothing is rewritten.

## Directed course structure

The sequence below is a **proposed content outline**, not final lesson IDs or a claim that the content exists:

1. Low E and A natural-note anchors and immediate root-finding use.
2. Octave patterns and locating equivalent pitches.
3. Connections across D, G, B and high E strings.
4. Intervals, chord roots and practical navigation.
5. Fluency across keys, positions and real musical contexts.

Each short lesson should unlock a practical musical use, prioritize high-value skills (80/20), provide a quick success, and have a clear stopping point. Final lesson graph, exact prerequisite edges, review cadence and placement rubric must be specified and tested before implementation.

## Dashboard Fretboard Mastery block

- Display real **current stage/lesson**, concise objective, actual progress (if measurable), review-due indication and a single clear **Continue Fretboard Mastery** / **Start Fretboard Mastery** / **Review** action appropriate to student state.
- The action opens or resumes the relevant lesson **in the learning environment**; it does not run the lesson on the dashboard.
- Offer a secondary route to explore specific notes, strings or keys through the Explorer. It must not imply the selection changes placement or unlocks lessons.
- Evolve through: not placed → placement/start → in progress → lesson completed/next recommended → review due → stage completed → ongoing fluency. Avoid invented completion, fake progress, fake XP and nonfunctional buttons.
- Maintain existing theme, navigation, accessibility and left-handed rendering; no parallel fretboard renderer or duplicate lesson engine.

## Wave 1 interconnection contract

The placement system is a **shared learning service**, not a fretboard-only quiz. Define typed, versioned skill, item, observation, evidence, curriculum, prerequisite, placement and access contracts that the existing Chord System, Fretboard, Lesson, Practice, Performance, Mastery and future Theory/instrument modules can use. Compose through an orchestration/service layer rather than circular direct imports. Instrument-specific question banks and curricula may vary while the assessment algorithm is reusable.

Wave 1 order: inspect existing engine APIs; define contracts; implement prerequisite graph; adaptive item selection and validated candidate bank (~60–80); evidence evaluation and placement; authorized access override; persistence and automated tests. Use three universal background questions followed by ~5–12 practical adaptive tasks, expanding only when evidence requires it. Keep full wizard, dashboard and Admin UI wiring for a later integration wave.

## Implementation seams and data invariants

- Reuse pure TypeScript engines under `src/lib/engines/lessons`, `practice`, `mastery` and `performance`; Svelte components display engine state, not decide gates. Inspect actual APIs before designing interfaces.
- Per-student placement, current lesson, unlocked lesson IDs, completion evidence and wizard state persist through the established student data service and Rust ownership boundary; local JSON, offline only. Define versioned schemas and migration behavior in Phase 2.
- Never infer unlocked access solely from a UI route parameter. Route guards and lesson runners must enforce prerequisites; navigation alone cannot bypass them.
- Placement and reassessment should be resumable/retryable safely: incomplete assessment earns nothing; successful completion is saved consistently before changing access.
- Ensure dashboard, Learn, Practice and Progress use the same derived curriculum state. Avoid duplicated, contradictory sources of truth.
- Keep the current Phase 1 dashboard's honest placeholder behavior until the actual curriculum and persistence are implemented.

## Acceptance tests for Phase 2

1. New student chooses fundamentals: only first directed lesson unlocked, no fabricated mastery.
2. Experienced student demonstrates prerequisites: placed later; all earlier lessons accessible; subsequent lessons locked.
3. Self-report alone cannot advance or unlock.
4. A student can revisit earlier lessons without losing placement or progress.
5. Direct URL/navigation to a future lesson is rejected by the learning layer.
6. Meeting a defined progression gate unlocks exactly the next eligible lesson.
7. Exploring a note, string or key changes no curriculum gate or mastery.
8. Interrupted assessment grants no placement; retake preserves prior verified progress.
9. Reassessment can raise placement on verified evidence; cannot reduce earned access or delete mastery.
10. Dashboard reflects persisted current lesson and review state after restart, sign-out and account switch, without leaking between students.
11. Accessibility, left-handed view, offline operation and honest empty states remain intact.
12. Three universal background questions appear before adaptive practical tasks; self-report does not affect unlocks by itself.
13. A chord-specific weakness does not invalidate demonstrated fretboard skill; a single mistaken answer is confirmed rather than treated as decisive.
14. Admin Open All Lessons grants access only to the selected student's curriculum, is audited and does not fabricate mastery, XP or completions.
15. Revoking Open All Lessons restores the legitimately verified access frontier without erasing earned evidence; a different student remains unaffected.

16. A student placed beyond Beginner lessons counts them as covered for Automatic Learning Unlock; no completion, XP or mastery record is created.
17. Lessons opened only by Open All Lessons do not count toward Automatic Learning Unlock.
18. Restoring an older student backup after Open All Lessons was revoked does not bring the override back.

## Open implementation decisions

- Exact course lesson IDs, prerequisite graph and stage completion gates.
- Adaptive placement item bank, evidence sufficiency, assessment duration and how to handle mixed skills.
- How lessons completed while Open All Lessons was active contribute to later prerequisite gates (proposal: a completed lesson counts like any completion, because completion has its own evidence gate).
- Whether reassessment is launched from Progress, Settings, Learn or multiple places.
- Student-facing explanation and remediation for a failed placement gate.

**Authority:** These behaviors were agreed by the Project Owner on 2026-11-22, with subsequent explicit Wave 1 authorization for the engine foundation and metronome refinement. Coordinate with the Phase 1/Rust account architecture; do not merge or overwrite unrelated work without approval.
