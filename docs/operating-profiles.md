# Operating Profiles: Full Studio, Low-Power Field, No-Power Preparation

Architecture and roadmap only (Jason, 2026-11-22). **Not authorised for implementation.**

## Purpose

Let an administrator switch the whole installation between everyday use and prolonged grid-down conditions with limited power, without touching anyone's data, progress or permissions. Profiles are chosen **manually** in Administrator Settings; the app never switches on its own.

## The three profiles

| | Full Studio | Low-Power Field | No-Power Preparation |
| --- | --- | --- | --- |
| Goal | Everything authorised and implemented | Longest battery life while still learning, writing and playing | Print and export physical resources before power runs out |
| Home screen | Normal dashboards | Simplified **Field Dashboard** | **Offline Field Library and Print/Export Center** |
| Lessons, practice, mastery | Yes | Yes | Yes (for printing worksheets and lesson sheets) |
| Fretboard Explorer, Chord Library, Chord Finder | Yes | Yes | Yes |
| Songbook, Songwriting Studio | Yes | Yes | Yes (open, edit, print) |
| Reference | Yes | Yes | Yes |
| Tuner | Yes | Yes (microphone only while the Tuner is open) | Yes (see decision 2) |
| Metronome | Yes | Yes (audio started on Play) | Yes, lightweight click only, no synth |
| MIDI playback | Yes | Loaded only when the student presses Play; administrator can turn it off | Not initialised |
| Recording (Riff Recorder) | Yes | Loaded only when the student presses Record; administrator can turn it off | Not initialised |
| Backing tracks | Yes | Off by default; administrator can turn it on | Not initialised |
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

## Decisions for Jason

1. **Default profile:** Full Studio as the installation default everywhere, including Android, with the administrator choosing Low-Power Field when wanted (my recommendation, since you asked for manual selection)?
2. **Tuner in No-Power Preparation:** keep it available (it runs only while open and helps prepare instruments), or hide it to keep that profile focused on printing?
3. **Field Dashboard for students:** replace the normal dashboard in Low-Power Field (my recommendation), or offer it as an option?
4. **Idle unload timings:** suspend audio after 30 seconds of silence and unload the synth after 2 minutes idle, adjusted after measurement?
