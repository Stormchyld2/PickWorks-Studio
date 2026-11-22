# Shared transport and rhythm timing

Architecture only, final refinement pass 2026-11-22. **Not authorised for implementation.** Roadmap placement: [master-roadmap.md](master-roadmap.md) milestone X0.5 (clock-source abstraction), used from X1 (Low-Power Field metronome) onward.

## Decision

PickWorks keeps **one musical transport** for every tool: metronome, MIDI playback, progression playback, rhythm practice and highlighting, ear-training rhythm exercises, backing tracks, recording alignment and Performance Mode auto-scroll. No tool builds its own timer, tempo or loop logic. What changes is only **where the transport gets its time from**, through a small clock-source abstraction.

## What exists today

- `engines/audio/transport.ts` (pure): tempo, bars and beats, tempo changes without jumps, loop regions.
- `services/audio/transport.ts`: drives it with a 25 ms timer only while running, scheduling ahead against the shared AudioContext's clock.
- The metronome is a transport consumer; the tuner and reference tones share the same AudioContext (`services/audio/audio-engine.ts`), created on first use.

## Clock-source abstraction

```ts
interface ClockSource {
  kind: 'audio' | 'timer';
  now(): number;                 // seconds, monotonic
  outputLatency(): number;       // seconds between scheduling and hearing (0 for timer)
  start(): Promise<void>; stop(): void;
}
```

- **AudioClock** uses the shared AudioContext's `currentTime`. Sounds are scheduled ahead on exact sample frames (look-ahead scheduling: wake about every 25 ms, schedule everything in the next 100 ms). Used whenever anything audible plays.
- **TimerClock** uses `performance.now()` and never creates an AudioContext or loads a synthesizer. It drives visual-only playback: rhythm-pattern stepping, the visual metronome and highlight-only practice in Low-Power Field, and any tool when audio is off.
- The **transport** owns musical position (ticks, from the composition model's flattened timeline) and converts ticks to clock time with the tempo map (including ramps and swing). Consumers subscribe to the transport, never to a clock.
- **Switching clocks** (for example the student presses "Sound on" in a visual rhythm drill) stops the transport at its current tick, starts the new clock and resumes from the same tick. Musical position is continuous; there is never a second transport.
- **Highlighting** (the rhythm grid step, the TAB and notation playhead, chord cards, lyric auto-scroll) is drawn each animation frame from `transport.positionAt(clock.now() - clock.outputLatency())`, so with audio the highlight matches what is heard rather than what was scheduled.
- **Tap input** (rhythm practice and ear-training tap-back) is timestamped from the input event's own timestamp, mapped into the active clock's time, minus a per-device latency calibration the student can run once.

## Which tools use which clock

| Tool | Full Studio | Low-Power Field | No-Power Preparation |
| --- | --- | --- | --- |
| Metronome | Audio | Audio on Play (lightweight click, no synth); visual-only option uses Timer | Lightweight click on demand (Audio clock, no synth) |
| Rhythm & Strumming Studio | Audio (strums through the synth) | Timer (visual stepping); Audio on Play if MIDI is allowed | Not used (charts are printed) |
| Progression and song playback | Audio | Audio on Play if MIDI is allowed | Not available |
| Ear training rhythm exercises | Audio | Audio when the exercise starts | Not featured |
| Backing tracks, recording alignment | Audio | Audio if allowed | Not available |
| Performance Mode auto-scroll | Timer, or Audio when playback runs | Timer | Timer |

## Expected timing accuracy

| Measure | AudioClock target | TimerClock target |
| --- | --- | --- |
| Sound onset vs intended beat (offline render analysis) | within 1 ms (sample-accurate scheduling); acceptance threshold 5 ms | n/a (no sound) |
| Visual highlight vs intended beat | within one display frame (about 17 ms at 60 Hz) after latency compensation | within one display frame |
| Drift over 10 minutes | none (positions are calculated from the start time, not accumulated) | none, for the same reason |
| Tap evaluation windows (rhythm practice) | beginner ±90 ms, standard ±60 ms, strict ±35 ms, after calibration | same windows |
| Start latency from pressing Play | under 150 ms with sounds loaded | under 50 ms |

These are targets for the transport spike and later acceptance tests; they are measured on the reference Windows laptop and later on a mid-range Android tablet before they are treated as met.

## Timer throttling and limitations

- **Main-thread timers are not reliable timing sources.** Browsers and WebViews delay `setTimeout` under load and throttle it heavily in hidden windows (typically to about once per second, and more aggressively after several minutes hidden, depending on the engine's power-saving rules). `requestAnimationFrame` stops entirely while the window is hidden.
- The transport therefore uses timers only to **wake up and schedule ahead**, never to time a sound. Sound timing always comes from the AudioContext, which runs on the audio thread.
- When the window is hidden on Windows while audio is playing, the scheduler increases its look-ahead (to about 1.5 s) so playback continues smoothly through throttled wake-ups; visual highlighting pauses and resumes at the correct position. A further option, to be decided by the synthesizer spike, is running the scheduler inside an AudioWorklet so it isn't affected by main-thread throttling at all.
- TimerClock playback is visual, so it simply pauses while hidden (nothing to see) and resumes at the correct tick.
- Garbage collection or heavy rendering can delay a wake-up; the look-ahead window absorbs delays up to about 75 ms without any audible effect. Longer stalls are logged in development builds and count against the spike's acceptance thresholds.

## What happens when the app is backgrounded

| Platform | Event | Behaviour |
| --- | --- | --- |
| Windows | Window minimised or covered | Audio playback, metronome and recording continue (students often practise with the window minimised); visuals pause. The tuner keeps the microphone only while its page is open. The idle sign-out rule is unchanged. |
| Windows | Display sleep or lock screen | Same as minimised. Sign-out still happens at the idle limit, which stops audio through the sign-out pipeline. |
| Windows | System sleep or hibernate | On resume the transport is stopped at its last position (the AudioContext clock jumped); nothing plays until the student presses Play. |
| Android | App goes to background or screen turns off | Checkpoint runs; the transport stops at its current position; the microphone is released; the AudioContext is suspended. Recording is stopped and saved (a foreground-service recorder that keeps going with the screen off is a later decision). Nothing restarts automatically on resume; the student presses Play to continue from the same position. |
| Android | Audio focus lost (phone call, another app plays) | Transport stops at its current position; same resume rule. |

Details of the Android lifecycle are in [android-platform.md](android-platform.md).

## Tests (planned)

- One transport instance: tests and a static check confirm no tool creates its own interval-based timing for musical events.
- Offline-rendered audio at 60, 120 and 200 BPM with tempo ramps and swing: every onset within 1 ms of the calculated time (5 ms acceptance).
- Clock switching mid-pattern keeps the tick position exactly.
- TimerClock playback never constructs an AudioContext or synthesizer (verified with test spies).
- Hidden-window simulation (throttled timers) keeps scheduled audio gap-free for 10 minutes.
- Highlight position matches the sounding event within one frame after latency compensation, measured with a recorded loopback test on the reference laptop.
- Background and resume on Android stop and resume at the same tick, with the microphone released while backgrounded.
