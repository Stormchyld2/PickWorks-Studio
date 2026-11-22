# Operating Profiles: Full Studio, Low-Power Field, No-Power Preparation

Architecture **finalised** with Jason on 2026-11-22, with the final refinement pass the same day (No-Power home rule, binder permissions, lifecycle and power safety). **Not authorised for implementation.** Roadmap placement and feature cards: [master-roadmap.md](master-roadmap.md) (X0.4 capability layer, X1 Low-Power Field, X2 No-Power Preparation). Timing and clocks: [transport-timing.md](transport-timing.md). Android lifecycle: [android-platform.md](android-platform.md).

In a grid-down scenario power may come from solar generators, portable power stations or power banks, and a tablet or phone may be the only practical device. The profiles are designed for that.

## Purpose

Let an administrator switch the whole installation between everyday use and prolonged grid-down conditions with limited power, without touching anyone's data, progress or permissions. Profiles are chosen **manually** in Administrator Settings; the app never switches on its own.

## The three profiles

| | Full Studio | Low-Power Field | No-Power Preparation |
| --- | --- | --- | --- |
| Goal | Everything authorised and implemented | Longest battery life while still learning, writing and playing | Print and export physical resources before power runs out |
| Default | **Yes**, on Windows and Android | Chosen manually by the administrator | Chosen manually by the administrator |
| Home screen | Normal dashboards | Simplified **Field Dashboard** (automatic) | **Print/Export Center** with the Offline Field Library (a temporary home, shown even if the student has hidden Reference; see below) |
| Lessons, practice, mastery | Yes | Yes | Yes (for printing worksheets and lesson sheets) |
| Fretboard Explorer, Chord Library, Chord Finder | Yes | Yes | Yes |
| Songbook, Songwriting Studio | Yes | Yes | Yes (open, edit, print) |
| Reference | Yes | Yes | Yes |
| Tuner | Yes | Yes (microphone only while the Tuner is open) | Yes, on demand (microphone only while open) |
| Metronome | Yes | Yes (audio started on Play; visual-only option needs no audio) | Yes, on demand: lightweight click only, no synth |
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

## No-Power Preparation home and workspace visibility (resolved 2026-11-22)

The Print/Export Center lives in the Reference workspace. In No-Power Preparation it is the **temporary home for everyone**, even a student who has hidden Reference in their own workspace preferences:

- The profile shows the Print/Export Center as the start screen and keeps a "Print/Export Center" entry at the top of the sidebar while the profile is active.
- This is a **display rule of the profile only**. It never changes the student's saved workspace visibility, startup workspace, last-used workspace, administrator workspace access or any permission. Those records aren't written at all.
- The rest of the sidebar still follows the student's own visibility and the administrator's access rules.
- When Full Studio is restored, the student's normal home and workspace choices apply again exactly as they were.
- The Tuner and the lightweight metronome stay available on demand in every profile from the shared Tools group.

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

Jason's addition: one action in the Print/Export Center builds a complete printable **field binder** in a single operation. It ties the three profiles together: create music in Full Studio, keep learning on a solar-charged tablet in Low-Power Field, and keep a physical music library when there's no electricity at all. Delivered with Expanded Print Studio at X2 ([master-roadmap.md](master-roadmap.md)).

**Two kinds of binder (initial release):**

| | My Field Binder (student) | Shared binder (administrator) |
| --- | --- | --- |
| Who builds it | A signed-in student, for themselves | The administrator |
| Contents | Their lessons, chords, references, blank sheets and **their own songs** | Shared educational and reference material: lesson sheets for a chosen course and level, chord charts, fretboard and scale references, blank sheets, guides |
| Student songs | Their own, freely | **None**, unless a student has explicitly authorised specific songs (below) |
| Reads private compositions | Only the student's own | Never without authorisation; with it, only the authorised songs, read-only |

**Steps:** choose the binder type (students see only their own), review the suggested contents (everything pre-ticked, can be unticked), choose paper size or the screen-reading layout, then **Build Binder**. The result is one PDF saved to a chosen folder or USB drive, plus the option to print it.

**Save to PDF never needs a printer.** It works in every profile, before and after the power goes out, and it's the default action; printing is optional. The PDF can be copied to other devices and read in any PDF viewer, and a **screen-reading layout** (single column, larger text, one song or chart per page) can be chosen for phones, tablets and e-readers. PDFs come from the shared PDF writer working on the shared SVG renderers, so no printer driver and no WebView print path is involved ([android-platform.md](android-platform.md) section 3).

**Contents, in order:**

1. Cover page (name or "Shared binder", date, PickWorks logo) and a table of contents with page numbers.
2. Lessons: for My Field Binder, completed lessons for review and the next lessons in the student's course; for a shared binder, the lessons of the chosen course and level.
3. Essential chord charts: the chosen level's chords, the core beginner set and (My Field Binder) every chord used in the student's songs, drawn by the shared chord renderer.
4. Fretboard and scale references matching the course.
5. Songs as lead sheets (chords over lyrics, plus TAB where it exists): the student's own songs in My Field Binder; in a shared binder only songs a student has authorised.
6. Practice worksheets and blank writing sheets: blank TAB, staff paper, chord boxes and songwriting worksheets (the number of each is adjustable).
7. Maintenance and tuning guides, once that content has passed the sourcing and review process.

### Field binder permissions (resolved 2026-11-22)

Student-owned songs and recordings stay private to the student. The rules for the initial release:

1. Students can build their own field binder at any time, in any profile.
2. Administrators can build shared educational and reference binders **without reading any student's compositions**.
3. Including a student's songs in an administrator-built binder requires that student's **explicit authorisation**.
4. Authorised administrator access is **read-only, limited to the songs named in the authorisation, limited to binder building, and recorded in the Audit Log**.
5. Students never gain access to another student's songs through binder building, backup, export or import; Rust resolves every student path from the signed-in student's own session.
6. Building a binder never modifies lessons, progress, XP, mastery, tour records or song data. It writes only the PDF to the chosen location (and the audit entry).
7. Everything works offline.

**Authorisation workflow (student side).**

1. Signed in, the student opens **Settings › Privacy › Share songs for a field binder**.
2. They tick the songs to share (individual songs; there is no "all songs, including future ones" option) and choose how long the permission lasts: **for one binder** (the default, used up by the next binder build that includes them), **30 days**, or **until I turn it off**.
3. A plain-language confirmation explains: the administrator will be able to see these songs' lyrics, chords and TAB only to put them in a printed binder; they can't change them; recordings are never included; and a binder already printed or saved can't be taken back.
4. Rust saves the authorisation in the student's own folder (`sharing/binder-grants.json`: grant id, song ids, purpose `field-binder`, created, expiry, status) and writes an audit entry ("Student allowed 3 songs for a field binder").

**Use (administrator side).**

1. In the binder builder, the administrator sees, per student, only "N songs shared for binders" with titles, never other songs. Students with no active authorisation show "No songs shared"; the app suggests asking the student in person (there is no request or messaging system).
2. Ticking those songs makes Rust open, read-only, only the authorised song ids for that build, after checking the grant is active, unexpired and still matches existing songs. The song data passes to the renderer for preview and the PDF; nothing is cached after the build.
3. Each build writes an audit entry: administrator, student, grant id, song ids, sections included, date and output type (PDF or print). A "for one binder" grant is marked used.

**Revocation.**

- The student can turn off any authorisation at any time from the same Settings page; it takes effect immediately, including for an administrator who has the builder open (the next read is refused and the songs disappear from the preview).
- Authorisations also end automatically when they expire, when they've been used (one binder), when a shared song is deleted (that song only), and when the student is archived or deleted.
- Every revocation, expiry and automatic end is audited. A revoked grant can't be revived; the student creates a new one.
- Administrators can't create, extend or edit authorisations, and password resets don't affect them.

**Other rules:**

- Black and white, consistent page numbers, works offline, duplex-friendly (sections start on odd pages). Pages are counted in advance so the right amount of paper and ink is known.
- Works in any profile, and is the main action of No-Power Preparation.
- Depends on Expanded Print Studio (X2); until then, the action doesn't appear.

**Tests:** a My Field Binder with lessons, songs and chords contains each selected section with a correct table of contents and page numbers; unticked sections are absent; the student's files are byte-identical before and after; a student token can't build another student's binder or read another student's songs; an administrator token reads no student song without an active grant, reads exactly the granted songs with one, and is refused immediately after revocation, expiry, use of a one-binder grant, song deletion or archiving; every grant, use, revocation and expiry is audited; output is black and white; building works with networking blocked, on Windows and Android, with no printer installed, in every profile and both layouts.

## Lifecycle, storage and power safety

How the profiles behave when things go wrong or the device changes state. Clock and background details: [transport-timing.md](transport-timing.md); Android specifics: [android-platform.md](android-platform.md).

| Situation | Behaviour (all profiles unless stated) |
| --- | --- |
| **Android: app backgrounded and resumed** | Checkpoint runs on going to the background; transport stops at its position; microphone released; AudioContext suspended; in Low-Power Field the synthesizer is unloaded straight away. On resume nothing restarts by itself; the student sees the same screen and presses Play to continue. If the idle limit passed meanwhile, the student is signed out on return. If Android stopped the app, it restarts at the profile selector and offers recovered drafts after sign-in. |
| **Screen off** | Android: treated as backgrounding (above). Windows: display sleep doesn't stop audio the student started (metronome, playback); visuals pause; the idle sign-out rule still applies and stops audio through the sign-out pipeline. Performance Mode and active recording may keep the screen on. |
| **Microphone release and audio shutdown** | The microphone is held only while the Tuner, a recording or a microphone exercise is open, and is released on leaving it, on sign-out, on profile or workspace switch and on backgrounding. Stopping audio follows one order: stop the transport, stop and save any recording, release the microphone, unload the synthesizer if the profile says so, then suspend or close the AudioContext (30 s of silence before suspension in Low-Power Field; synthesizer unload after 2 minutes idle; both initial values to be confirmed by measurement). |
| **Interrupted exports (PDF, binder, song, backup)** | Output is written to a `.partial` file and renamed only when complete and verified; an interruption leaves no file that looks finished; leftover partial files are removed on the next attempt or start-up. Source data is only ever read, so nothing else is affected. |
| **Low storage** | Every large write (PDF, binder, export, backup, recording, import) checks free space first and refuses with a message saying how much is needed. Autosave failures are shown immediately and never truncate the previous file. In No-Power Preparation the Print/Export Center shows each pack's estimated size before export. |
| **Power loss during autosave** | Writes are atomic (temporary file, flush, keep `.bak`, rename) and songs keep an operation journal, so power loss leaves either the old or the new version, never a broken one, and loses at most the last 2 seconds of song edits. A partial recording is recovered as a playable file on the next start. |
| **Profile switching with unsaved work** | The checkpoint runs first. If anything can't be saved (for example low storage), the switch is **cancelled** with a message naming what couldn't be saved; it never switches and discards. A running recording is stopped and saved before the switch. |
| **Restoration to Full Studio** | One click from the Operating Profile card or the administrator dashboard shortcut. Visual effects and photos return, the normal dashboards return as home, and each student's own workspace preferences apply as before. Heavy services (synthesizer, recorder) are **not** preloaded; they load on first use as usual. No student, installation or progress file changes except the profile setting itself, which is audited. |

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

Stages follow [master-roadmap.md](master-roadmap.md):

- **X0.4 (after workspace navigation Stage B):** the capability layer, the administrator card and Full Studio, with no visible change for students. Building it early means every later feature declares its capability from day one.
- **X1:** Low-Power Field and the Field Dashboard (reduced visuals, AudioContext suspension, visual-only metronome on the TimerClock), with measurements.
- **X2:** No-Power Preparation, the Print/Export Center as its home and the field binder, with Expanded Print Studio.
- **X4 and X6 (each heavy feature: synthesizer, recorder, backing tracks):** its Low-Power behaviour and measurements.
- **Android stage:** Field screens and lifecycle behaviour tested on real phones and tablets.

## Decisions

**Resolved by Jason (2026-11-22):**

1. Full Studio is the default installation profile on Windows and Android; the other two are chosen manually by the administrator.
2. The tuner stays available on demand in No-Power Preparation.
3. Low-Power Field automatically uses the Field Dashboard.
4. 30 seconds of silence before audio suspension and 2 minutes idle before the synthesizer unloads are the initial values, to be validated by real performance and battery measurements.
5. No separate engines, catalogs or file formats per profile.

6. In No-Power Preparation the Print/Export Center is the temporary home even if the student has hidden Reference; this never changes their workspace visibility or permissions.
7. Field binders: students build their own; administrators build shared binders without reading student compositions; student songs in an administrator binder only with the student's explicit, revocable, audited authorisation.

**Still open:** none for this document.
