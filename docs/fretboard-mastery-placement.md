# Fretboard Mastery: placement, directed progression and dashboard contract

**Status:** Approved product behavior, documented 2026-11-22. **Implementation:** Phase 2 learning core; not implemented or authorized by this document. Owner approval is required before feature coding. This document is the design-detail source for placement and progression; [master-roadmap.md](master-roadmap.md) controls scheduling and [requirements-v1.md](requirements-v1.md) controls the locked note-mastery rule.

## Purpose and boundaries

Fretboard Mastery is a **directed curriculum** with an individually placed starting point. The dashboard is a **continuously evolving progress and navigation block**, **not a lesson or drill surface**. The actual instruction, fretboard interactions, questions, assessments and feedback belong in Learn/Practice/Fretboard lesson experiences. The dashboard presents the student's current lesson, recommended next action, progress and review needs, with a link to resume the appropriate lesson. Do not show an invented lesson, progress percentage or completed mission before real data exists.

Students may freely revisit **any earlier unlocked lesson**, including lessons below their placement, but **may not jump forward beyond their current unlocked progression**. A future lesson remains locked until its prerequisite gate is satisfied. A learner can explore notes, strings and musical keys independently in Fretboard Explorer without changing the directed curriculum's gates.

## First-time per-student Skill Placement Wizard

- Show after first successful student-account setup/sign-in, before the first normal dashboard. It belongs to each student, not the installation or administrator. Existing students require a safe migration/default path.
- Keep it brief, accessible and ADHD-friendly. Ask about playing experience and self-reported skills to choose appropriate assessment items, **not** to grant unlocks. Distinguish note-finding, string familiarity, octave patterns, intervals and key knowledge; playing years and chord fluency are not equivalent to fretboard knowledge.
- New players can choose **Start with fundamentals** without testing. Other students may take a short, practical **placement assessment** using the existing lesson/performance/mastery evaluation architecture. Do not use theory trivia alone.
- Provide an understandable recommended starting lesson and an explanation of the evidence. Do not attach permanent Beginner/Intermediate/Advanced labels to the student.
- A skipped or interrupted assessment must not grant advancement. Allow a later reassessment; never erase existing achievements, earned mastery or prior attempts. Placement is per curriculum and per student, not global.
- Do not promise that a 3–5 minute assessment can certify every advanced skill: use adaptive sampling and mark unverified prerequisites as needing a targeted check. Exact assessment items, pass criteria and maximum placement leap require a separate Phase 2 design and tests before implementation.

## Placement, access and mastery are separate concepts

- **Placement** identifies the first recommended directed lesson, based on observed evidence or the student's choice to start at the beginning.
- **Unlocked access** means a lesson is available. At initial placement, all preceding lessons and the placed lesson are unlocked; subsequent lessons are locked. Earlier lessons remain accessible for review.
- **Mastery** is earned only by the approved mastery engine and evidence rules. Placement does **not** automatically grant note mastery, XP, completed missions or fabricated lesson-completion history.
- **Progression gate:** successful completion of the current stage's defined prerequisites opens the next directed lesson. Never allow manual selection to bypass a locked gate. An explicit reassessment can establish a higher placement by verifying the relevant prerequisite evidence, without awarding mastery for skipped material.
- **Exploration:** allow choosing a note, a string, or a musical **key** as separate study targets; a note and a key are not interchangeable. Exploration is independent of directed lesson advancement and cannot silently unlock a stage.
- **Review:** previously unlocked lessons remain available even when accuracy later declines; recommend review rather than relocking earned access.

The existing locked **note-mastery rule** remains unchanged: most recent 10 attempts per note, at least 90% qualifying independent correct responses under 3 seconds, with qualifying answers on at least two distinct days; see [requirements-v1.md](requirements-v1.md). Placement assessment qualification and stage progression are separate decisions and must not be misrepresented as note mastery. Define their specific evidence gates during Phase 2 without weakening the note-mastery rule.

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

## Open implementation decisions

- Exact course lesson IDs, prerequisite graph and stage completion gates.
- Adaptive placement item bank, evidence sufficiency, assessment duration and how to handle mixed skills.
- Whether reassessment is launched from Progress, Settings, Learn or multiple places.
- Student-facing explanation and remediation for a failed placement gate.

**Authority:** These behaviors were agreed by the Project Owner in conversation on 2026-11-22. The UI branch may document them; implementing the wizard, persistence or progression gates is a separate authorization.
