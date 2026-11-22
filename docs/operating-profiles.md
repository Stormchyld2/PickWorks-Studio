# Operating Profiles: Full Studio, Low-Power Field, No-Power Preparation

Architecture **finalised** with Jason on 2026-11-22. **Not authorised for implementation.** Roadmap placement and feature cards: [master-roadmap.md](master-roadmap.md).

In a grid-down scenario power may come from solar generators, portable power stations or power banks, and a tablet or phone may be the only practical device. The profiles are designed for that.

## Purpose

Let an administrator switch the whole installation between everyday use and prolonged grid-down conditions with limited power, without touching anyone's data, progress or permissions. Profiles are chosen **manually** in Administrator Settings; the app never switches on its own.

## The three profiles

| | Full Studio | Low-Power Field | No-Power Preparation |
| --- | --- | --- | --- |
| Goal | Everything authorised and implemented | Longest battery life while still learning, writing and playing | Print and export physical resources before power runs out |
| Default | **Yes**, on Windows and Android | Chosen manually by the administrator | Chosen manually by the administrator |
| Home screen | Normal dashboards | Simplified **Field Dashboard** (automatic) | **Offline Field Library and Print/Export Center** |
| Lessons, practice, mastery | Yes | Yes | Yes (for printing worksheets and lesson sheets) |
| Fretboard Explorer, Chord Library, Chord Finder | Yes | Yes | Yes |
| Songbook, Songwriting Studio | Yes | Yes | Yes (open, edit, print) |
| Reference | Yes | Yes | Yes |
| Tuner | Yes | Yes (microphone only while the Tuner is open) | Yes, on demand (microphone only while open) |
| Metronome | Yes | Yes (audio started on Play) | Yes, lightweight click only, no synth |
| MIDI playback | Yes | Loaded only when the student presses Play; administrator can turn it off | Not initialised |
| Recording (Riff Recorder) | Yes | Loaded only when the student presses Record; administrator can turn it off | Not initialised |
| Backing tracks | Yes | Off by default; administrator can turn it on | Not initialised |
| Rhythm & Strumming Studio | Yes | Yes; visual playback without audio, audio on Play if allowed | Print rhythm charts |
| Chord Progression Generator, Music Theory Tools, Melody & Harmony Assistant | Yes | Yes; audition on demand | Generate and print charts |
| Ear Training Studio | Yes | Yes; audio starts only when an exercise starts | Not featured (needs sound) |
| Notation and TAB editing | Yes | Yes (rendering only; playback follows MIDI setting) | Yes (for printing) |
| Visual effects | Normal | Reduced (no animation, no glow or blur, no photos); administrator can restore | Reduced |
| Banner | None | Small "Low-Power Field" badge in the top bar | Clear notice: "PickWorks still needs power. This profile helps you print and export what you'll need when electricity isn't available." |

## How it fits the existing design

- **A separate layer.** A feature is shown only when all three are true: it is **implemented**, the student has **workspace access** (administrator access rules and student visibility, unchanged), and the **operating profile** allows it. Profiles never change workspace access, lesson completion, XP, mastery, practice history, tour records or files.
- **One pure function decides.** `capabilities(profile, overrides, platform)` in `engines/profiles/` returns flags (`midi`, `recording`, `backingTracks`, `visualEffects`, `fieldDashboard`, `printCenterHome`...). Every feature registers which capability it needs when it is built, so new features fit profiles automatically and no screen hard-codes profile rules.
- **Same engines, same files.** There is no separate engine, project format, chord catalog or lesson set per profile. Songs, lessons, chord catalogs and backups are identical and fully accessible in every profile.
- **Storage.** The installation profile and overrides are kept with the installation settings in the account index, beside self-registration and workspace access. Rust accepts changes only from a signed-in administrator, and each change is written to the Audit Log.

## Administrator controls

Administrator Settings gets an **Operating Profile** card:

- Three large choices (Full Studio, Low-Power Field, No-Power Preparation), each with one sentence on what it does.
- **Overrides** for Low-Power Field: MIDI playback, recording, backing tracks and visual effects, each "Profile default", "On" or "Off".
- A short "What changes" list for the selected profile (taken from the same capability data, so it can't drift).
- **Restore Full Studio** is always one click, at the top of the card, whatever profile is active. In the other two profiles the administrator dashboard also shows a "Restore Full Studio" shortcut.

Students see the active profile as a badge and can open a short explanation, but cannot change it.

## Switching safely

1. The administrator picks a profile; a confirmation lists what will change and states that no data, progress or permissions change.
2. The app runs the existing checkpoint (the same save used when going to the background), so any unsaved work is saved first. Normally no student is signed in while the administrator is, but the checkpoint runs regardless.
3. Services the new profile doesn't use are stopped cleanly: transport and metronome stop, the microphone is released, the synthesizer and its sounds are unloaded, and the shared AudioContext is closed (it is already created only on first use).
4. The new profile is saved and applied immediately; no restart is needed.
5. Anyone who follows an old link to a feature that's off sees a calm explanation card ("MIDI playback is off in the Low-Power Field profile. Your administrator can turn it back on."), never a broken or greyed-out control. Navigation lists simply leave such features out.

## Exactly what each profile changes

**Services and background processes**

| Item | Today | Full Studio | Low-Power Field | No-Power Preparation |
| --- | --- | --- | --- | --- |
| Shared AudioContext | Created on first audio use, then stays open | Same | Created on demand; **suspended** after 30 s of silence, closed when leaving audio screens | Created only for the metronome click if used; closed afterwards |
| Synthesizer and SoundFont (planned) | n/a | Loaded on first playback, kept for the session | Loaded on Play; **unloaded** after 2 minutes idle | Never loaded |
| Recorder worklet (planned) | n/a | On Record | On Record; released afterwards | Never loaded |
| Transport timer (25 ms) | Runs only while playing | Same | Same | Same |
| Tuner analysis (microphone) | Runs only while the Tuner is open | Same | Same | Same (decision 2) |
| Session timer (1 s, idle sign-out) | Always while signed in | **Unchanged** (security rule) | Unchanged | Unchanged |
| Autosave and checkpoint | On background and sign-out (songs: every few seconds while editing, planned) | Same | Same, never relaxed (data safety) | Same |
| Chord catalog and search index | n/a (planned) | Loaded when the Chords tab opens | Same | Same |
| Network | Always off (offline-first, CSP) | Off | Off | Off |

**Screens and visuals**

| Item | Full Studio | Low-Power Field | No-Power Preparation |
| --- | --- | --- | --- |
| Home | Normal dashboards | Field Dashboard | Field Library and Print/Export Center |
| Header and card photos | Shown | Hidden (plain cards) | Hidden |
| Glow borders, blur, gradients | Shown | Flat equivalents in the same palette | Flat |
| Animations and transitions | Normal (or reduced if the student chose) | Off (same as reduced motion) | Off |
| Playback, recording, backing track controls | Shown | Shown if allowed, load on use | Hidden |
| Branding | Logo and theme unchanged in every profile | Unchanged | Unchanged |

## Field Dashboard (Low-Power Field)

Large touch-friendly tiles (at least 44 px targets, two columns on phones, three or four on tablets and laptops): **Continue lesson**, **Practice**, **Fretboard**, **Chords**, **Songbook**, **Write a song**, **Tuner**, **Metronome**, **Reference**. One line of status at the top (signed-in student, profile badge, battery level where the platform reports it). No photos, no animation, no live charts. Student workspace visibility still applies; tiles for hidden or inaccessible workspaces don't appear.

## Offline Field Library and Print/Export Center (No-Power Preparation)

A single screen of printable and exportable packs, each with a preview and a page count:

- Chord charts (by level, or the student's own chord groups), fretboard references, scale charts.
- Lesson sheets and practice worksheets.
- Songwriting worksheets, blank TAB, blank staff paper, blank chord boxes.
- Maintenance and tuning guides (once that content passes the approved sourcing and review process).
- The student's personal songbook as lead sheets.
- "Export everything to a folder or USB" (PDFs plus a full backup).

It uses the shared renderers and the Print Studio page layout, so it depends on Print Studio being authorised and built. Until then, this profile shows only what actually exists.

### Prepare for Grid-Down (field binder)

Jason's addition: one administrator action in the Print/Export Center that builds a complete printable **field binder** for a chosen student in a single operation. It ties the three profiles together: create music in Full Studio, keep learning on a solar-charged tablet in Low-Power Field, and keep a physical music library when there's no electricity at all.

**Steps for the administrator:** pick a student, review the suggested contents (everything is pre-ticked and can be unticked), choose paper size, then **Build Binder**. The result is one PDF saved to a chosen folder or USB drive, plus the option to print it straight away.

**Save to PDF never needs a printer.** It works in every profile (Full Studio, Low-Power Field and No-Power Preparation), before and after the power goes out, and it's the default action; printing is optional. The PDF can be copied to other devices and read in any PDF viewer, and a **screen-reading layout** (single column, larger text, one song or chart per page) can be chosen for phones, tablets and e-readers instead of the paper layout. The app needs no printer driver to save a PDF, because the PDF is written from the shared SVG renderers.

**Contents, in order:**

1. Cover page (student name, date, PickWorks logo) and a table of contents with page numbers.
2. The student's lessons: completed lessons for review and the next lessons in their course, as printable lesson sheets.
3. Essential chord charts: the chords from the student's level, every chord used in their songs, and the core beginner set, drawn by the shared chord renderer.
4. Fretboard and scale references matching the student's course.
5. The student's personal songs as lead sheets (chords over lyrics, plus TAB where it exists).
6. Practice worksheets and blank writing sheets: blank TAB, staff paper, chord boxes and songwriting worksheets (the number of each is adjustable).
7. Maintenance and tuning guides, once that content has passed the sourcing and review process.

**Rules:**

- Built entirely from the shared renderers and Print Studio page layout: black and white, consistent page numbers, works offline, duplex-friendly (sections start on odd pages).
- **Read-only.** Building a binder never changes the student's files, progress, XP, mastery or tour records. It writes only the PDF to the chosen location.
- **Privacy.** Songs belong to the student. Including them means the administrator's binder action reads that student's songs (read-only), which today's ownership rule doesn't allow. Rust would grant this one read-only purpose to an administrator, and every binder build is written to the Audit Log with the student's name and the sections included. See decision 5.
- Works in any profile, but is the main action of No-Power Preparation. Pages are counted in advance so the administrator knows how much paper and ink is needed.
- Depends on Print Studio; until then, the action doesn't appear.

**Tests:** a binder for a student with lessons, songs and chords contains each selected section with a correct table of contents and page numbers; unticked sections are absent; the student's files are byte-identical before and after; a student token can't build another student's binder; the audit entry is written; output is black and white only; building works with networking blocked and on Windows and Android; Save to PDF works with no printer installed, in every profile, in both paper and screen-reading layouts.

## Measuring instead of assuming

Each restriction must earn its place with measurements on reference hardware (a battery-powered Windows laptop now; a mid-range Android tablet and phone later). Measured per profile, with the same scripted scenario (sign in, open dashboard, run a lesson, browse chords, open a song, idle 10 minutes):

- **Startup time** to first interactive screen.
- **Memory** of the app and WebView processes, at idle and during playback.
- **CPU** average and peak, at idle and during each activity.
- **Battery** drain over a fixed 60-minute script (Windows battery report and energy estimates; Android battery statistics).

Results go into a table in this document. A restriction that doesn't make a measurable difference (for example under 2% CPU, 20 MB memory or a visible battery change) is dropped to keep the app simple. Measurements are repeated whenever a stage adds a heavy service (synth, recorder, notation).

## Tests (planned)

- **Switching:** every pair of profiles in both directions; Restore Full Studio always works; the profile survives restart.
- **Data preservation:** hashes of every student and installation file are identical before and after any switch; unsaved song edits are checkpointed before the switch.
- **Permissions:** students cannot change the profile (Rust refuses a student token); workspace access and visibility are identical in every profile; every change is audited.
- **Services:** in No-Power Preparation, the synthesizer and recorder are never constructed (verified by test spies); in Low-Power Field they load only on Play or Record and unload when idle; the microphone is released on switching.
- **No broken controls:** for each disabled capability, navigation hides it and a deep link shows the explanation card.
- **Offline:** every profile passes the offline test suite with networking blocked.
- **Resource budgets:** automated startup, memory and idle-CPU checks in CI on Windows against the measured baselines, so a regression is caught.
- **Touch:** Field Dashboard and Print/Export Center pass touch-target and layout checks at phone, tablet and desktop widths.

## Roadmap placement

- **With workspace navigation Stage B or creative Stage 1:** the capability layer, the administrator card, Full Studio and a first Low-Power Field (reduced visuals, AudioContext suspension, Field Dashboard). This is small, and building it early means every later feature declares its capability from day one.
- **With each heavy feature (synth, recorder, backing tracks):** its Low-Power behaviour and measurements.
- **With Print Studio:** the No-Power Preparation profile and the Print/Export Center.
- **Android stage:** Field screens tested on real phones and tablets.

## Decisions

**Resolved by Jason (2026-11-22):**

1. Full Studio is the default installation profile on Windows and Android; the other two are chosen manually by the administrator.
2. The tuner stays available on demand in No-Power Preparation.
3. Low-Power Field automatically uses the Field Dashboard.
4. 30 seconds of silence before audio suspension and 2 minutes idle before the synthesizer unloads are the initial values, to be validated by real performance and battery measurements.
5. No separate engines, catalogs or file formats per profile.

**Still open:** the field binder reading a student's songs (master-roadmap.md D5), and the No-Power home when a student has hidden Reference (D2).
