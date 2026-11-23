# Guided tours and contextual help (architecture, approved 2026-11-22)

Status: **documented only**. Nothing here is built until Jason explicitly authorises it. The first Learning Studio tour is planned for Phase 2, once the main learning screens exist. The Play & Create and Reference tours follow when those workspaces get their first working features.

## 1. When tours launch

There are three independent workspace tours:

| Tour id | Workspace id | Launches automatically |
| --- | --- | --- |
| `learning-studio` | `learning-studio` | Once, on the student's first successful sign-in, after initial account setup (including any forced password change) |
| `play-create` | `play-create` | Once, the first time that student enters Play & Create |
| `reference` | `reference` | Once, the first time that student enters Reference |

Rules:

- Each tour launches automatically **only once per student**.
- Tours never restart automatically on later sign-ins, on ordinary page navigation or after app updates.
- A student may skip any tour at any step, and restart it later by hand. Skipping counts as dismissing the tour for all future automatic launches.
- No tour launches for a workspace that is unimplemented, locked, hidden from the student's dropdown or otherwise inaccessible.
- Opening a new page never starts a tour. Only these three workspace tours ever launch automatically.
- An automatic tour never interrupts an active lesson, assessment, recording or practice session (see section 10). If one is running, the launch waits until it ends.

A tour launches automatically only when all of these are true:

1. `autoLaunched` is false for this student and tour (status "never shown").
2. The workspace is implemented and the student has access (administrator access rules or the automatic learning unlock; see the workspace plan).
3. The workspace is not hidden in the student's dropdown.
4. The student is in that workspace now: first sign-in for Learning Studio, first entry for the others.
5. No lesson, assessment, recording or practice session is active.

## 2. Balloon popups

Tours use anchored balloon popups that highlight real interface controls. Each balloon has:

- A short title.
- A brief explanation, ideally one or two sentences.
- A step indicator, such as "3 of 8". The total counts only the steps shown to this student.
- **Next**, **Back**, **Skip Tour** and **Learn More**.

The highlight marks the control without blocking the rest of the interface more than needed. Text stays short and practical, so a student understands what a feature is for without reading long instructions.

## 3. Learn More modal

**Learn More** opens a larger help modal for the highlighted feature. It contains:

- A fuller explanation of what the feature does.
- How to use it.
- An example of when the student would use it.
- An optional screenshot or diagram (real app screenshots only).
- **Try It Now**, only when a suitable working feature exists.
- **Return to Tour**.

Opening Learn More keeps the current step. Closing it (Return to Tour, Escape or the close button) brings the student back to the same balloon, never the start of the tour.

**Try It Now** may open the real feature, which pauses the tour at that step with status "in progress". It never awards XP, completes a lesson, changes mastery or creates achievement or progress records. The student can resume the tour from Help, from the step they left.

## 4. Learning Studio tour (proposed initial content)

The sequence is shortened when a feature isn't available. Fake controls or placeholder screens are never added to fill a step. Learn More text must match what is actually built at release time.

| Step | Highlights | Balloon | Learn More covers | Shown when |
| --- | --- | --- | --- | --- |
| 1. Welcome to PickWorks Studio | Dashboard | "Welcome to PickWorks Studio! This is your Learning Studio, where you'll find your next lesson, practice activities, and progress." | The dashboard: current course, Try This, Fretboard Mastery, progress, recent practice, quick actions. Everything shown comes from the student's own records. | Always |
| 2. My Courses | Learn in the sidebar | "Your courses teach you guitar through short, practical lessons. Start with the basics and build your skills one step at a time." | The 80/20 approach, short learning missions, lesson progression, immediate musical use, how lessons and checkpoints work. | A course is playable (Phase 2) |
| 3. Practice | Practice in the sidebar | "Practice helps you strengthen what you've learned through short exercises and musical challenges." | Practice sessions, note identification, chord transitions and other drills that exist. Practice is different from verified mastery: mastery needs real performance, not just XP. | Always (Practice exists today) |
| 4. Fretboard Explorer | Fretboard in the sidebar | "Explore notes, chords, and scales directly on the interactive guitar fretboard." | Selecting notes, reading chord diagrams, exploring scales, using the fretboard as a free reference. Only implemented tabs are described. | Always |
| 5. My Progress | Progress in the sidebar | "Track the skills you've learned and see what you're ready to practice next." | Course completion, practice history, mastery and any other indicators that exist. No simulated progress. | Progress page shows real data |
| 6. Tuner | Tuner in the sidebar | "Use the tuner to help get your guitar ready before you practice." | Microphone permission, string selection, pitch feedback, recognising sharp, flat and in tune, matched to the real tuner. | Always |
| 7. Metronome | Open Metronome (Practice page or Quick Action) | "The metronome helps you practice with a steady beat and develop better timing." | BPM, starting and stopping, practising slowly before speeding up, a simple exercise if supported. | Always |
| 8. Workspace Selector | The selector | "PickWorks has different workspaces for learning, creating music, and reference tools." | Learning Studio, Play & Create and Reference. Access is set by the administrator (Unlock All Workspaces, automatic learning unlock, per-student access). Students control which workspaces show in their dropdown. Unimplemented workspaces are never presented as working. | The selector is built and visible |
| 9. Student Profile and Settings | Profile area and Settings | "Your profile keeps your learning progress and preferences separate. Settings lets you customize your experience." | Profile isolation, the student's own preferences, accessibility, workspace visibility, where to find Help. No administrator-only features. | Always |

## 5. Play & Create tour

Written when the workspace first has working features, using the same balloons and Learn More. Possible topics: workspace dashboard, Songbook, Music Theory Tools, Backing Tracks, Riff Recorder, Songwriting Studio, Practice Journal. Only features that are implemented at that time are included.

## 6. Reference tour

Written when the workspace first has working features. Possible topics: Printable Resources, Guitar Maintenance, Tuning & Field Skills, Offline Music Library, Low-Power Tools. Only working features are described.

## 7. Manual replay and contextual help

- A **Guided Tours** section in Help (linked from Settings) lists every tour whose workspace the student can access, with its status.
- Students can replay any accessible tour at any time, including completed or skipped ones, from the start or from the last step reached.
- Feature-specific tutorials (for example the Chords tab or the Tuner) use the same balloon and Learn More system. They start only when the student chooses one from Help or a clearly labelled help control, never automatically during normal navigation.
- Replaying a tour never changes lessons, XP, achievements or mastery.

## 8. Per-student tracking

Stored separately for each student and each workspace, in the student's own folder as a versioned `tutorials` record, like preferences. No SQLite and no separate database.

```json
{
  "schemaVersion": 1,
  "data": {
    "learning-studio": {
      "tutorialId": "learning-studio",
      "workspaceId": "learning-studio",
      "status": "completed",
      "lastStep": 7,
      "contentVersion": 1,
      "autoLaunched": true,
      "updatedAt": "2026-..."
    },
    "play-create": {
      "tutorialId": "play-create",
      "workspaceId": "play-create",
      "status": "never",
      "lastStep": 0,
      "contentVersion": 0,
      "autoLaunched": false,
      "updatedAt": null
    }
  }
}
```

- `status`: `never` (never shown) | `in-progress` | `completed` | `skipped`.
- `lastStep`: the step reached, for resuming.
- `contentVersion`: the version of the tour the student last saw.
- `autoLaunched`: set to true the moment the automatic launch happens, before the first balloon shows. This is the single switch that prevents a second automatic launch, so closing the app mid-tour doesn't cause a relaunch; an "in progress" tour is resumed from Help instead.

Once a tour is completed or skipped, new tour content never launches it automatically. A newer `contentVersion` may show a small "Updated" label in Help, and the student can replay the new version by hand.

The record is included in student and installation backups and restores like the student's other files. Rust's student-ownership checks apply to it like any other student file. Administrators can't edit it, and changing installation defaults or workspace access doesn't touch it.

## 9. Accessibility and responsive behaviour

Required:

- Keyboard navigation through every balloon and modal control, with visible focus.
- Screen-reader announcements for each step (title, text, "step 3 of 8").
- Escape closes the Learn More modal and returns to the step.
- Focus is trapped in the modal and restored to the balloon when it closes; when the tour ends, focus returns to where the student was.
- Reduced motion: no animated movement between steps.
- Text scaling and high contrast follow the student's accessibility settings.
- Touch-friendly targets (44 px minimum on touch screens, as in the Android foundation).

Layout follows the shared breakpoints:

- Windows and Android tablets (840 px and wider): the balloon sits beside the highlighted control.
- Android phones (under 600 px): a compact anchored popup, or a bottom sheet where needed.
- If the window is resized, rotated or split, the highlighted control is scrolled back into view and the balloon re-anchors.
- If the control is in a collapsed sidebar or phone drawer, the tour opens it for that step and restores it afterwards.

## 10. Session and safety behaviour

- An automatic tour never interrupts an active lesson, assessment, recording or practice session.
- Tour interaction counts as student activity for the idle-timeout timer.
- Viewing a tour never awards XP, mastery, achievements or course completion.
- The current student session is kept while moving through the tour; a tour never signs anyone out or switches profile. If the idle timeout signs the student out mid-tour, the status is saved as "in progress" and the tour doesn't auto-launch again.
- If a highlighted control is missing when its step comes up, that step is skipped safely.

## 11. Design requirements

The tour keeps the original in-app logo, the charcoal and navy theme, blue accents, and the approved card and modal styling. Existing navigation and dashboard layouts stay as they are. Highlighting is subtle, without heavy animation. The tour adapts to the real interface; no screen is redesigned to suit it.

## 12. Where it lives in the code (planned)

- `engines/tours/` (pure, tested): tour definitions, `shouldAutoLaunch(tour, record, access, session)` and `visibleSteps(tour, features)`.
- `stores/tours.svelte.ts`: loads and saves the `tutorials` record and starts tours.
- `components/tour/`: highlight, balloon and Learn More modal, shared by every platform.

Each step declares the feature it explains (for example `feature: "fretboard-explorer.chords"`). The engine shows a step only if that feature is implemented and visible to the student. Step text is reviewed with each release like other student-facing wording.

## 13. Tests (planned)

- Auto-launch happens exactly once per student per tour, and never after "completed" or "skipped", including after a `contentVersion` bump.
- A tour interrupted by closing the app or the idle timeout doesn't auto-launch again, and resumes from Help at the saved step.
- Navigating to any page other than a workspace's first entry never launches a tour; feature tutorials never auto-launch.
- No auto-launch for unimplemented, locked or hidden workspaces, or while a lesson, assessment, recording or practice session is active.
- Steps for unavailable features are dropped and the "x of y" count matches the steps shown.
- Learn More and Escape return to the same step; Try It Now leaves XP, lessons, mastery and achievements unchanged.
- Replaying a tour leaves lessons, XP, achievements and mastery unchanged.
- Tour interaction resets the idle timer.
- Two students on one installation have independent tour records.
- Keyboard-only run through a whole tour, focus trap and restore, and reduced-motion behaviour (Playwright).
