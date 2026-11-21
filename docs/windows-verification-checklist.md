# Phase 1: Windows verification checklist

Things the automated tests can't prove. Run these on a real Windows PC with the
installer built from the Phase 1 branch, then note anything that fails.

## Install and first run
- [ ] The installer runs and the app opens. The taskbar and desktop shortcut show the pick icon.
- [ ] First-run setup appears; no default password works.
- [ ] The recovery key shows once; Copy and Print both work (print shows only the key).
- [ ] With Wi-Fi off, everything below still works.

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
