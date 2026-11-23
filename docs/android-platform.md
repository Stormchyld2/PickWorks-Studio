# Android compatibility review

Architecture only, final refinement pass 2026-11-22. **No Android feature is implemented yet, and none is authorised.** Android is a future deployment target (phones and tablets), but these interfaces shape the Windows design now so nothing has to be rebuilt later. Responsive layout rules are in [architecture.md](architecture.md) ("Android phones and tablets"). Roadmap: [master-roadmap.md](master-roadmap.md).

Statements about Android behaviour come from Android's developer documentation and general platform knowledge; each one is re-checked on real devices when Android work starts. **Nothing here assumes that something working in Windows WebView2 works the same way in Android's WebView.**

## 1. App-private storage

- Tauri's app data folder is `%APPDATA%\com.pickworks.studio` on Windows and the app's private internal storage on Android. The Rust core already resolves every path from it, so accounts, student folders, songs, backups and the audit log carry over unchanged.
- Private storage is invisible to other apps and removed when the app is uninstalled. The app must therefore **make backups easy to copy out** (section 2) and say plainly, in Backups & Restore, that uninstalling removes local data.
- Atomic writes (temporary file, flush, keep `.bak`, rename) work the same on Android's file system. Rename is atomic within one folder, so temporary files stay in the destination folder, as they already do.
- Storage is limited and shared with the user's photos and apps. Free-space checks (section 8) apply to every large write.

## 2. File picker and document access

- Android apps don't get raw file paths to shared storage or USB drives. Files outside private storage are reached through the **Storage Access Framework**: the system picker returns a `content://` document reference, which the app reads or writes as a stream.
- PickWorks already never passes paths from the interface (Rust opens the picker on Windows). On Android the platform adapter opens the system picker ("create document" for exports and PDFs, "open document" for imports and backup copies) and passes the stream to Rust. Interface code is identical on both platforms.
- USB drives and SD cards appear in the same picker when the device supports them; nothing USB-specific is needed.
- Long-lived access (for example a remembered backup folder) uses persistable permissions on the chosen folder, and the app copes with that permission being revoked or the drive being removed (a clear message, no crash, the backup kept in private storage).
- Validation rules for imported archives (composition-model.md section 14) apply exactly as on Windows; a picked file is treated as untrusted input.

## 3. PDF export and printing

Investigated for the Print Studio decision (creative-workstation.md section 9).

- **Android's WebView doesn't print from JavaScript.** Android's documentation states that JavaScript in a page can't trigger printing; apps print web content through the native `PrintManager` with an adapter created from a WebView (`createPrintDocumentAdapter`). Saving as PDF that way goes through the system print dialog and depends on a "Save as PDF" print service being present, which is common but not guaranteed on every device.
- **So Windows WebView2's print-to-PDF does not establish Android support**, and PickWorks will not rely on either WebView's print path to make PDFs.
- **Recommended architecture: one PDF writer, the same on both platforms.** Print Studio already builds every page as SVG from the shared renderers. A PDF writer converts those SVG pages directly into a PDF file, with fonts embedded, without any print dialog, printer driver or network. Candidates to evaluate (licences to be verified before adoption):
  - in Rust inside the core: an SVG-to-PDF converter such as the `svg2pdf` and `usvg` crates (reported as MIT or Apache-2.0), which keeps memory out of the WebView for large binders;
  - in TypeScript as a fallback: a PDF library with SVG support (for example jsPDF with svg2pdf.js, reported as MIT).
- **Saving:** Windows saves through the existing Rust folder picker; Android saves through the system "create document" picker or the share sheet. The default is Save to PDF, which never needs a printer.
- **Printing (optional):** Windows prints the generated PDF or the same SVG pages through WebView2's print dialog; Android passes the generated PDF to `PrintManager` with a small native adapter. Printing is offered only when a print service exists.
- This choice is confirmed by the PDF writer spike (creative-workstation.md section 3), which isn't authorised yet.

## 4. Microphone permissions

- Android asks for microphone permission at run time. PickWorks asks only when a feature that needs it starts (the Tuner, a recording, an ear-training tap-back with microphone input), with an explanation card first ("The tuner listens to your guitar. Nothing is recorded or saved.").
- If permission is refused, the feature shows a calm explanation and how to allow it in system settings; the rest of the app works normally. If permission is withdrawn while the app runs, capture stops cleanly and the same card appears.
- The microphone is held only while the feature using it is open and is released on navigation, sign-out, profile switch and backgrounding. Only one feature holds it at a time (tuner or recorder), through the shared audio engine.

## 5. Audio initialisation and lifecycle

- The AudioContext is created only on a user action (Play, Start, opening the Tuner), as today, and is suspended when the app goes to the background and when audio focus is lost (a call, another app playing). It is never resumed automatically; the student presses Play.
- Output latency differs a lot between devices and with Bluetooth headphones. The transport compensates highlights with the reported output latency, and rhythm practice offers a one-time calibration ([transport-timing.md](transport-timing.md)).
- The synthesizer and its sounds load on first playback and unload after idle according to the operating profile; sound-set size is chosen so a mid-range tablet can hold it (measured in the synthesizer spike).
- On low-memory warnings from the system, the app unloads the synthesizer and caches first, after a checkpoint.

## 6. Battery optimisation

- PickWorks does no background work: no background sync, no scheduled jobs, no wake-ups. Doze and app standby therefore need no special handling, and the app never asks to be excluded from battery optimisation.
- No wake lock is held except an optional "keep screen on" in Performance Mode and during an active recording, released when they end.
- The Low-Power Field profile is the main battery tool; its measurements on a real tablet and phone decide which restrictions stay (operating-profiles.md, "Measuring instead of assuming").

## 7. Touch-based fretboard and notation editing

- Touch targets at least 48 dp on Android (44 px minimum elsewhere), with visible buttons for every action; gestures are extras only.
- **Fretboard on phones:** a scrollable window of about 5 frets with a position indicator, frets wide enough for 48 dp targets, open and mute toggles beside each string label, and landscape for the full neck. The Chord Finder's one-position-per-string input works by tap and needs no drag.
- **Notation and TAB on touch:** tap to place the cursor, a docked palette for durations, rests, accidentals and techniques, a fretboard or keypad for pitch and fret entry, and step buttons (previous, next, up, down) so nothing needs precise dragging. Long-press actions always have a visible alternative.
- **Phones view and do simple entry first; tablets edit fully** (as already planned). Layout follows window width, not device type.
- Pinch zoom on scores and diagrams is an extra beside zoom buttons.

## 8. Interrupted saves, background behaviour and process death

- **Android can stop a backgrounded app at any time without warning.** So:
  - checkpoints run whenever the app goes to the background (already built as save-on-background in the Android foundations);
  - songs journal each operation within 2 seconds while editing (composition-model.md section 11), so even a process killed without warning loses at most the last couple of seconds;
  - recordings write a playable partial file that is repaired on the next start.
- **Session security after process death:** the session token lives only in memory, so a killed app starts at the profile selector and the student signs in again. Recovered drafts are offered after sign-in, to the same student only.
- **Idle sign-out while backgrounded** is measured by wall-clock time: if the idle limit passed while the app was in the background, the student is signed out on return (the checkpoint already ran when the app went to the background).
- **WebView renderer crash:** the native side restarts the WebView at the profile selector; Rust-side data is unaffected because every write is atomic.
- **Low storage:** before large writes (recording, import, export, backup, PDF), the app checks free space and refuses with a clear message rather than failing part-way. A failed save never truncates the existing file.
- **Rotation and split-screen** don't restart the app's state; the layout simply responds to the new width.

## 9. What this means for Windows work now

1. No interface code passes file paths, ever (already true).
2. Every large write checks free space first and is atomic or uses a `.partial` file.
3. PDFs come from the shared PDF writer, not from WebView print.
4. Audio starts only on user action and tolerates being suspended.
5. All checkpointing goes through the one lifecycle pipeline.
6. Touch targets and visible alternatives for every gesture in every new screen.

## Tests (when Android work is authorised)

- Storage, accounts, songs and backups pass the existing Rust tests on an Android build.
- Export, import and backup copy round-trip through the system picker, including a USB drive and a revoked permission.
- PDF output from the shared writer opens in common Android PDF viewers; printing works where a print service exists and is hidden where it doesn't.
- Microphone permission refused, granted and withdrawn while running.
- Process killed during song editing and during recording recovers as specified.
- Field Dashboard, Chord Finder, Songwriting and the notation editor pass touch-target and layout checks at phone and tablet widths.
