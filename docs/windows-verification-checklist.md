# Phase 1: Windows verification checklist

Things the automated tests can't prove. Run these on a real Windows PC with the
`pickworks-studio.exe` built by GitHub Actions from the Phase 1 branch (the
"pickworks-studio-windows-exe" artifact on the Windows build), then note
anything that fails. There's no installer yet, so there's no desktop shortcut;
Windows 10 and 11 already include the WebView2 runtime the app needs.

## Install and first run
- [ ] The .exe opens (Windows SmartScreen may warn because it isn't signed yet: More info, Run anyway). The window and taskbar show the pick icon.
- [ ] First-run setup appears; no default password works.
- [ ] The recovery key shows once; Copy and Print both work (print shows only the key).
- [ ] With Wi-Fi off, everything below still works.
- [ ] Data is in `%APPDATA%\com.pickworks.studio` (paste that into File Explorer's address bar): folders `accounts`, `students`, `administration`, `backups`, `application`.
- [ ] In Command Prompt, `icacls "%APPDATA%\com.pickworks.studio"` lists only your Windows user, SYSTEM and Administrators.
- [ ] Sign in to a different Windows account on the same PC (if you have one): PickWorks starts at first-run setup there, because each Windows account has its own data.

## Accounts and sessions
- [ ] Add two students from Student Management with temporary passwords.
- [ ] Each student must choose their own password at first sign-in.
- [ ] Three wrong passwords make the screen wait 30 seconds; the countdown is right.
- [ ] A student signed in and left alone gets "Still there?" at 19 minutes and is signed out at 20. The administrator: 4 and 5 minutes.
- [ ] Playing into the tuner and running the metronome keep the session awake.
- [ ] Closing the window while signed in, then reopening: the profile screen appears and a password is needed.
- [ ] Student A's settings (left-handed, A4 pitch) don't appear for student B.

## Administrator recovery
- [ ] "Forgot the administrator password?" with the recovery key sets a new password and shows a new key; the old key stops working.
- [ ] "I lost the recovery key" → "Restart with Windows Approval" shows the Windows UAC prompt. Approving it reopens the app on the reset screen; declining leaves the app as it was.
- [ ] Both recoveries appear in the Audit Log.

## Backups
- [ ] Back up everything, change a student's progress, restore the student backup: their progress returns and their current password still works.
- [ ] Restore everything: you're signed out, and the passwords from backup time work.
- [ ] Copy to USB or Folder on a student backup: the Windows folder picker opens, the copy lands on the USB drive as `pickworks-backup-...`, and the success message names it.
- [ ] Copy an Everything backup: the administrator password is asked for first; a wrong password stops it before the picker opens.
- [ ] Choosing a folder inside the app's own data is refused.
- [ ] Delete a backup's folder from the app data (or use a second PC), then Bring Back From USB or Folder: it reappears in the list, and Restore works as usual.
- [ ] Edit any file inside the USB copy, then bring it back: it's refused as damaged and nothing changes.
- [ ] Cancel the picker: nothing happens and no error shows.
- [ ] Unplug the USB drive mid-copy: an error shows, and no half-written backup is left in the list.
- [ ] Permanent delete only works after archiving and typing the name.

## Audio (needs a guitar)
- [ ] Tuner with the built-in microphone: all six strings of standard tuning read correctly.
- [ ] Tuner with an audio interface (if available): input channel selection works.
- [ ] Choosing an input and output in Settings › Audio sticks after signing out and back in.
- [ ] Metronome at 60, 120 and 240 BPM stays steady for 2 minutes; subdivisions sound in time; accent on beat 1.
- [ ] Signing out while the tuner or metronome runs stops all sound and turns off the microphone light.

## Display
- [ ] Text size Large and Larger, and high contrast, look right on every screen.
- [ ] Left-handed mirrors the fretboards.
- [ ] Keyboard only: Tab reaches every control, "Skip to content" appears on first Tab, focus outlines are visible.
- [ ] Links to outside websites do not open (offline-first).

## Round 2 (after the first Windows test)
- [ ] Profile screen shows **Create Student Profile**. Create one with a name, a picture and an 8+ character password: it opens straight into that student's dashboard.
- [ ] A second profile with the same name is refused. The new student can't reach any admin page.
- [ ] Admin › Settings › Student Profiles: turn it off. The profile screen shows "Add Student (Admin)" again, and the setting is in the Audit Log.
- [ ] Fretboard › **Chords**: every chord in the list shows on the neck and in the diagram; try note names and intervals; turn on left-handed in Settings and check both mirror.
- [ ] Fretboard › **Scales**: change the root and the scale; root notes are highlighted.
- [ ] Practice › **Open Metronome** opens the metronome; Play, tempo, time signature and tap tempo work and it sounds in time.
- [ ] Dashboard: no developer notices; the guitar photo is a wide band across the top; course shows "Not started yet, 0% complete".
- [ ] Learn, Practice, Progress, Help and Print show plain wording, not milestone numbers.
- [ ] Minimise the window while signed in, then come back: still signed in, nothing lost.

## Round 3 (dashboard structure A-G)
- [ ] Dashboard has no large fretboard. **Fretboard Mastery** shows the current objective and, for a new student, the Start Here notes for the low E and A strings (no made-up numbers).
- [ ] **Open Fretboard Explorer** (amber) opens the Explorer on Notes.
- [ ] **Try This: Show Me E Minor** opens Fretboard › Chords with E minor already selected.
- [ ] Quick Actions: Tuner, Metronome and Chord Shapes open the right tools; Print Worksheet is marked "Coming soon" and opens the Print page.
- [ ] At the smallest window (1280 wide) and maximised, the two columns line up, nothing overlaps and the Quick Action names fit inside their tiles.
- [ ] Collapse the sidebar on the dashboard: the cards widen and still line up.


## Round 4 (Workspace Navigation Stage B)
- [ ] Student sidebar: **Workspace: Learning Studio** selector under the logo; items read Dashboard, My Courses, Practice, Fretboard Explorer, My Progress, Print Materials; a **Tools** group holds Tuner and Metronome; no Achievements item.
- [ ] Click the selector: the list opens under it, shows only Learning Studio with a tick and "More workspaces will appear here as they're ready", and the dashboard does not move. Escape, a click outside and choosing Learning Studio each close it.
- [ ] Keyboard only: Tab to the selector, Down Arrow opens it, Up/Down/Home/End move, Enter chooses, Escape closes and puts focus back on the selector.
- [ ] Collapse the sidebar: the selector becomes an icon; clicking it opens the list beside the rail, fully inside the window, also at the smallest window size and with Larger text.
- [ ] Open the Metronome from Tools: only Metronome is highlighted (not Practice).
- [ ] Settings › **Workspaces**: Start in, Remember the last workspace, Keep the sidebar collapsed (sidebar collapses straight away and stays collapsed after signing out and back in), Learning Studio can't be hidden, Play & Create and Reference say "Not available yet".
- [ ] Admin › Settings › **Workspace Access**: turn Unlock All on and off and Automatic Learning Unlock off and on; each change appears in the Audit Log; students still see only Learning Studio.
- [ ] Admin › Student Management: the new **Workspace access** button opens the dialog for that student; Play & Create and Reference say "Not available yet".
- [ ] A student's lessons, XP, progress and settings are unchanged after all of the above.
