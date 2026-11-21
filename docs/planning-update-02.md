# Planning Update 02: offline resilience, connectivity and chord diagrams

Status: planning. Recorded from Jason's "Planning Update 02" (2026-11-21).
**Nothing in this document authorises implementation.** It adds to [feature-roadmap.md](feature-roadmap.md) and does not change [requirements-v1.md](requirements-v1.md).

Sections are kept apart the same way as the roadmap:

1. Requirements (direction Jason has confirmed)
2. Accepted concepts (on the roadmap, not authorised to build)
3. Proposed architecture (responsibilities, not mandated modules)
4. Recommendations that are **not** locked
5. Unresolved decisions

## 1. Requirements

### Offline-first and long-term offline resilience

- PickWorks Studio must stay fully usable **without internet for months at a time**, including in emergency or grid-down conditions.
- Everything a student needs to learn and practise ships with, or is stored by, the app: lessons, exercises, fretboard and theory engines, tuner, metronome, print materials, progress data.
- No feature may require an account, a licence check, a server call or an online update to keep working.
- Student data stays local. Backup and restore must work to local files (for example a USB drive) without any service.
- Fonts, icons, images and other assets are bundled, never loaded from a CDN.

Current state (verified 2026-11-21): the app makes no network requests. Inter and the Lucide icons are bundled; photos and branding are local files.

### Connectivity policy (for future online features)

- A future **Online / Offline toggle** is planned but **deferred**. Do not build the toggle or its UI yet.
- When any internet-dependent service is eventually built (for example optional downloads or online chord resources), it must go through **one central connectivity policy**, never call the network directly.
- **Offline Mode must actually stop network behaviour**, not just hide buttons. With Offline Mode on, no feature makes a request.
- Online features are always optional extras. Turning them off, or losing the connection, never breaks a core feature.

## 2. Accepted concepts (not authorised to build)

### Native Chord Diagram Generator

Accepted direction. The app draws chord diagrams itself from structured data instead of relying on image files.

Each chord is described by data:

- name, root and quality
- string and fret positions, open and muted strings
- fingering (which finger on each note)
- barres
- multiple voicings of the same chord
- the tuning it is written for
- left-handed display (mirrored view only; notes and theory unchanged, as in locked decision 4)

It should be used by:

- lessons
- the interactive chord library
- the chord transition trainer
- the Practice Session Builder
- the TAB reader / player
- Print Studio (black and white, like the fretboards)
- the Virtual Instructor (future)
- assessments, **respecting the Mini Test rules**: a diagram must not reveal the answer in an assessment (locked decision 1)

### Online chord resources

Online chord images or references are **optional and supplementary only**. The native generator is the primary source. Any online resource goes through the connectivity policy and disappears cleanly in Offline Mode.

## 3. Proposed architecture

These extend the shared responsibilities in the roadmap.

| Responsibility | Notes |
| --- | --- |
| **Connectivity policy** | A single place that decides whether any network access is allowed. Online services ask it first. Offline Mode is enforced here, and ideally also at the app level (for example the Tauri content security policy) so a missed check still cannot reach the network. |
| **Chord data** (part of Fretboard / Theory Engine) | Chord shapes as validated data. Note names and intervals are calculated from the tuning and positions with the existing note and fretboard engines, never typed in by hand. |
| **Chord diagram rendering** | One renderer used on screen and in Print Studio, sharing the fretboard engine's positions and left-handed mirroring. |
| **Answer visibility** | Whether an answer may be shown is decided by the practice/assessment engine (`answerAvailable`), and any tool that could reveal an answer (diagrams, note labels, hints) asks it rather than deciding for itself. |
| **Local backup and restore** | Already planned with storage (Milestone 5); works fully offline. |
| **Bundled content packs** | Lessons and chord data ship inside the app. Any later optional downloads add to them; they never replace the bundled baseline. |

## 4. Recommendations, not locked

- **Proposed lesson sequence:** Discover → Try → Apply → Mini Test → Feedback and next step. This fits the existing lesson steps (discover, recall, play, tool, review) but is not a locked format.
- **"Hybrid Mastery"** is recommended only. The locked v1 note-mastery rule (requirements-v1.md, decision 2) is unchanged.

## 5. Unresolved decisions

- When the Online / Offline toggle is built, where it lives and what its default is.
- Which online services, if any, are ever added (content downloads, chord images, updates).
- Chord library scope for the first release (which chords and how many voicings).
- Chord data format details (for example how barres and partial barres are described).
- Whether Hybrid Mastery replaces or extends the v1 mastery rule.
- Whether the proposed lesson sequence becomes the standard lesson format.
