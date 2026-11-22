# Locked v1 requirements

Decisions confirmed by Jason. Change only with his approval, and record the date here.

## Decisions (2026-11-21)

| # | Feature | v1 decision | Where it lives |
|---|---|---|---|
| 1 | Show Answer | Visible during lessons and practice; hidden during Mini Tests and assessments. A revealed answer never counts as a successful independent recall. Mini Tests must not expose the answer through hints, keyboard shortcuts or any other control before the student submits. | `engines/practice/session.ts` (`assessment`, `answerAvailable`, `revealAnswer`), `engines/mastery` (`revealed` attempts) |
| 2 | Note mastery | Rolling window of the most recent 10 attempts per note. Mastered only when all three hold at once: at least 90% of the window are qualifying answers (correct, not revealed, under 3 seconds), and qualifying answers fall on at least two different days. Each attempt stores its timestamp. Thresholds are configurable internally; students cannot change them in v1. | `engines/mastery/attempts.ts` (`DEFAULT_MASTERY_CONFIG`), `engines/mastery/mastery.ts` |
| 3 | Student profiles | ~~One local student profile per installation.~~ **Superseded by Planning Update 04 (Decision 36):** multiple password-protected students plus a separate administrator. See [planning-update-04.md](planning-update-04.md). | `src-tauri/core` |
| 4 | Left-handed mode | Mirrored fretboard display setting. Mirrors the drawing only; note identities, tuning and theory calculations are unchanged. | `components/fretboard/Fretboard.svelte` (`leftHanded`), `engines/print` (`leftHanded`) |
| 5 | Copyright | © PickWorks Studio, all rights reserved. | About screen |
| 6 | Print Studio | 1, 2, 4 or 6 fretboards per printed page. | `engines/print/worksheet.ts` |

## Navigation (2026-11-21)

Dashboard, Learn, Practice, Fretboard, Print Materials, Tuner, Progress, then Settings, Help, About. Tuner sits above Progress because it is a frequently used hands-on tool.

## Smart Tuner (2026-11-21)

- Built in on Windows (any microphone, USB microphone or audio interface, with channel choice) and native on Android.
- Guided and Chromatic modes. Automatic string detection with manual override.
- Presets in the picker: Standard (default), Drop D, Half-Step Down, Open G. More presets and saved custom tunings work without changing the pitch engine.
- Real pitch detection (McLeod Pitch Method) with smoothing, silence and noise rejection and a confidence check. Never declares in tune from one reading.
- In tune within ±5 cents, optional ±2 cents. A4 adjustable, default 440 Hz.
- Hz is shown precisely enough to agree with the cents shown (two decimals).
- Reference tones; optional in-tune chime. Green means in tune, blue means adjust.
- Tune All Six Strings: guided sequence, each string marked done after holding a stable, accurate pitch.
- Runs offline; no recordings are saved.

## Work scope rule (2026-11-21)

1. Engines may be built from the current spec without further approval.
2. UI foundation only: navigation, themes, shared components and the approved layouts. No redesigns or invented screens.
3. Completing individual features or expanding scope needs Jason's approval.
4. The Virtual Instructor stays an architectural provision (input, evaluation and coaching seams), not an implemented engine.

Spec, document or mockup changes are recorded but do not by themselves authorise code changes.

## Fretboard Mastery placement and directed access (approved 2026-11-22)

- Per-student first-use Skill Placement Wizard: self-report guides a brief practical assessment, but does not itself unlock lessons. A new player may start with fundamentals; experienced students can place ahead only through demonstrated prerequisites.
- All lessons **earlier than or equal to** the student's verified placement are accessible for review. Lessons **beyond the current unlocked progression** remain locked until required evidence or a verified reassessment qualifies the student. Free note/string/key exploration never unlocks directed lessons.
- Placement/unlock is not note mastery: do not award mastery, XP or fabricated lesson completions for skipped content. The locked note-mastery rule above is unchanged.
- Dashboard Fretboard Mastery is an evolving progress and **lesson-navigation** block, never the lesson itself. Instruction, exercises and assessment live in Learn/Practice/Fretboard learning experiences.
- Detailed behavior, Phase 2 scope and acceptance tests: [fretboard-mastery-placement.md](fretboard-mastery-placement.md). This decision documents requirements only and does not authorize feature implementation.

## Wave 1 decisions (approved 2026-11-22)

- **Engine-first, interoperable learning foundation:** Build stable, typed interfaces and shared orchestration connecting placement, curriculum/lessons, practice, performance, mastery, fretboard and Chord System. Future theory/instrument modules reuse contracts, not duplicate placement engines. UI wiring follows tested engines.
- **Adaptive placement:** Three universal, unscored questions cover playing experience, comfortable skills and learning goals. Approximately 5–12 adaptive practical tasks follow (more if needed), with a validated candidate question bank targeting 60–80 items. Evidence and prerequisite coverage—not years playing, chord count, or one miss—determine curriculum placement. All earlier lessons remain accessible; future lessons are gated. Placement never fabricates mastery, XP or completions.
- **Admin Unlock All:** Authorized per student and curriculum, audited, revocable, and limited to access; student isolation and legitimate progress are preserved. Admin UI can follow the Wave 1 engine.
- **Metronome visual and layout:** Windows: small semicircular/half-arc pendulum-dot indicator above-right of tempo, synchronized with audio timing; tempo remains prominent above four compact equal-size blocks in a 2×2 grid: Play/Stop, Tap Tempo, Volume, Time Signature. Android: responsive indicator near tempo and accessible touch controls. Respect reduced motion and preserve existing functionality. No independent visual audio clock.
- **Wave 1 authorization:** The owner expressly authorized engine foundation/placement development and this metronome UI refinement; no blanket approval for unrelated UI redesigns, merges or roadmap features. Detailed implementation and acceptance tests: [fretboard-mastery-placement.md](fretboard-mastery-placement.md), [architecture.md](architecture.md), [master-roadmap.md](master-roadmap.md).
