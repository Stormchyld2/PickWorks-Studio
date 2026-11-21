# Locked v1 requirements

Decisions confirmed by Jason. Change only with his approval, and record the date here.

## Decisions (2026-11-21)

| # | Feature | v1 decision | Where it lives |
|---|---|---|---|
| 1 | Show Answer | Visible during lessons and practice; hidden during Mini Tests and assessments. A revealed answer never counts as a successful independent recall. Mini Tests must not expose the answer through hints, keyboard shortcuts or any other control before the student submits. | `engines/practice/session.ts` (`assessment`, `answerAvailable`, `revealAnswer`), `engines/mastery` (`revealed` attempts) |
| 2 | Note mastery | Rolling window of the most recent 10 attempts per note. Mastered only when all three hold at once: at least 90% of the window are qualifying answers (correct, not revealed, under 3 seconds), and qualifying answers fall on at least two different days. Each attempt stores its timestamp. Thresholds are configurable internally; students cannot change them in v1. | `engines/mastery/attempts.ts` (`DEFAULT_MASTERY_CONFIG`), `engines/mastery/mastery.ts` |
| 3 | Student profiles | One local student profile per installation. Data is keyed by profile so more can be added later. | Storage (Milestone 5) |
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
