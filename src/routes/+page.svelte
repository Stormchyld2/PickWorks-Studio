<!--
  Student dashboard (approved 2026-11-22, following the approved mockup;
  structural changes A-G approved the same day: compact Fretboard Mastery
  card instead of a full fretboard, four Quick Actions, aligned card rows).
  Every figure comes from the signed-in student's saved data; before lessons
  exist the cards show honest empty states. Course progress, next mission,
  XP and level fill these same cards in Phase 2.
-->
<script lang="ts">
  import GraduationCap from '@lucide/svelte/icons/graduation-cap';
  import ChartColumn from '@lucide/svelte/icons/chart-column';
  import Target from '@lucide/svelte/icons/target';
  import Zap from '@lucide/svelte/icons/zap';
  import Grid3x3 from '@lucide/svelte/icons/grid-3x3';
  import Play from '@lucide/svelte/icons/play';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Clock from '@lucide/svelte/icons/clock';
  import Award from '@lucide/svelte/icons/award';
  import Layers from '@lucide/svelte/icons/layers';
  import AudioWaveform from '@lucide/svelte/icons/audio-waveform';
  import Timer from '@lucide/svelte/icons/timer';
  import Guitar from '@lucide/svelte/icons/guitar';
  import Check from '@lucide/svelte/icons/check';
  import X from '@lucide/svelte/icons/x';
  import Printer from '@lucide/svelte/icons/printer';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import { auth } from '$lib/stores/auth.svelte';
  import { dashboardSummary, type DashboardSummary } from '$lib/engines/student/summary';

  let summary = $state<DashboardSummary>(dashboardSummary([], []));
  let loadError = $state(false);

  // Reload whenever a different student signs in.
  $effect(() => {
    const data = auth.data;
    summary = dashboardSummary([], []);
    loadError = false;
    if (!data) return;
    Promise.all([data.attempts(), data.masteryEvents()])
      .then(([attempts, events]) => {
        if (auth.data === data) summary = dashboardSummary(attempts, events);
      })
      .catch(() => (loadError = true));
  });

  // Natural notes on the two anchor strings: a starting activity, not a statistic.
  const ANCHORS: { name: string; notes: [string, number][] }[] = [
    { name: 'Low E', notes: [['E', 0], ['F', 1], ['G', 3], ['A', 5], ['B', 7], ['C', 8], ['D', 10], ['E', 12]] },
    { name: 'A', notes: [['A', 0], ['B', 2], ['C', 3], ['D', 5], ['E', 7], ['F', 8], ['G', 10], ['A', 12]] },
  ];

  const last = $derived(summary.recentSessions[0]);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const mins = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
  const maxBar = $derived(Math.max(1, ...summary.recentSessions.map((s) => s.correct + s.incorrect)));
</script>

<header class="welcome">
  <h1>Welcome Back!</h1>
  <p>Continue your guitar journey and build fretboard mastery.</p>
</header>

<a class="glow-card course" href="/learn">
  <div class="tile" aria-hidden="true"><GraduationCap size={40} /></div>
  <div class="cmain">
    <div class="eyebrow">Current Course</div>
    <h2>Fretboard Foundations</h2>
    <p class="muted">Learn the fretboard, note locations, anchor notes, and octave patterns.</p>
    <div class="bar" role="progressbar" aria-label="Course progress" aria-valuenow={0} aria-valuemin={0} aria-valuemax={100}><span style:width="0%"></span></div>
  </div>
  <div class="cside">
    <span class="muted">Course Progress</span>
    <b>Not started yet</b>
    <span class="muted small">0% complete</span>
  </div>
  <ChevronRight size={26} aria-hidden="true" />
</a>

<div class="grid">
  <div class="col">
  <section class="glow-card mastery" aria-labelledby="fm-title">
    <div class="mhead">
      <h3 id="fm-title"><Grid3x3 size={22} /> Fretboard Mastery</h3>
      {#if summary.reviewDue > 0}<span class="due"><RotateCcw size={15} /> {summary.reviewDue} due for review</span>{/if}
    </div>
    <div class="objective">
      <div class="eyebrow">Current Objective</div>
      <b>Learn the natural notes on the low E and A strings</b>
      <p class="muted small">These two strings are your anchors: once you know them, you can find any note on the neck.</p>
    </div>
    {#if summary.fretboardAnswered === 0}
      <div class="start">
        <div class="eyebrow">Start Here</div>
        {#each ANCHORS as row (row.name)}
          <div class="srow">
            <span class="sname">{row.name}</span>
            <ol aria-label="Natural notes on the {row.name} string">
              {#each row.notes as [note, fret] (fret)}<li><b>{note}</b><span>{fret === 0 ? 'open' : fret}</span></li>{/each}
            </ol>
          </div>
        {/each}
        <p class="muted small">Click each of these frets in the Explorer and say the note out loud before it appears.</p>
      </div>
    {:else}
      <div class="mstats">
        <div><b>{summary.notesMastered}</b><span>Notes Mastered</span></div>
        <div><b>{summary.fretboardInProgress}</b><span>Still Learning</span></div>
      </div>
      <div class="nextskill">
        <span class="eyebrow">Next Recommended</span>
        <b>{summary.nextSkill ?? 'Keep exploring: try the D and G strings next'}</b>
      </div>
    {/if}
    <a class="go" href="/fretboard"><Play size={18} /> Open Fretboard Explorer <ChevronRight size={18} /></a>
  </section>

  <section class="glow-card next">
    <div class="photo"><img src="/images/mission-card.jpg" alt="" /><span class="tag">TRY THIS</span></div>
    <div class="ninfo">
      <div class="eyebrow">Explore</div>
      <h3>Learn your first chord: E minor</h3>
      <p class="muted">Just two fingers and all six strings. See where your fingers go, then strum it.</p>
      <a class="go" href="/fretboard?mode=chords&chord=e-minor-open"><Guitar size={18} /> Show Me E Minor <ChevronRight size={18} /></a>
    </div>
  </section>
  </div>
  <div class="col">
  <section class="glow-card progress">
    <h3><ChartColumn size={22} /> Your Progress</h3>
    <div class="stats">
      <div class="stat"><Target size={26} /><b>{summary.accuracy === null ? '–' : pct(summary.accuracy)}</b><span>Overall Accuracy</span></div>
      <div class="stat"><Layers size={26} /><b>0</b><span>Missions Completed</span></div>
      <div class="stat"><Award size={26} color="var(--pw-amber)" /><b>{summary.notesMastered}</b><span>Notes Mastered</span></div>
    </div>
    {#if summary.accuracy === null}<p class="muted small note">Your figures start counting with your first practice answers.</p>{/if}
  </section>


  <section class="glow-card recent">
    <h3><Target size={22} /> Recent Practice</h3>
    {#if loadError}
      <p class="muted empty">Your practice history couldn't be loaded right now.</p>
    {:else if last}
      <div class="lastskill"><span class="muted small">Last session</span> <b>{last.skill}</b></div>
      <div class="rp">
        <div class="ring" style:--p={last.accuracy}><b>{pct(last.accuracy)}</b><span>Accuracy</span></div>
        <ul>
          <li><Check size={18} color="var(--pw-primary-hover)" /> <b>{last.correct}</b> Correct</li>
          <li><X size={18} color="var(--pw-error)" /> <b>{last.incorrect}</b> Incorrect</li>
          <li><Clock size={18} /> <b>{mins(last.durationMs)}</b> Practice Time</li>
        </ul>
        <div class="bars" aria-label="Answers in your last {summary.recentSessions.length} sessions">
          {#each [...summary.recentSessions].reverse() as s (s.sessionId)}<i style:height="{((s.correct + s.incorrect) / maxBar) * 100}%"></i>{/each}
          <span>Last {summary.recentSessions.length} {summary.recentSessions.length === 1 ? 'Session' : 'Sessions'}</span>
        </div>
      </div>
      <a class="again" href="/fretboard"><RotateCcw size={16} /> Practice Again</a>
    {:else}
      <p class="muted empty">No practice sessions yet. Each session will show here with the skill you practised, your accuracy and the time spent, so you can pick up where you left off.</p>
    {/if}
  </section>

  <section class="glow-card qa-card">
    <h3><Zap size={22} color="var(--pw-amber)" /> Quick Actions</h3>
    <div class="qa">
      <a href="/tuner"><AudioWaveform size={30} />Tuner</a>
      <a href="/practice/metronome"><Timer size={30} />Metronome</a>
      <a href="/fretboard?mode=chords"><Guitar size={30} />Chord Shapes</a>
      <a href="/print"><Printer size={30} />Print Worksheet<span class="soon">Coming soon</span></a>
    </div>
  </section>
  </div>
</div>

<style>
  .welcome {
    position: relative;
    margin: -76px -32px 4px;
    padding: 64px 32px 10px;
    min-height: 180px;
    background:
      linear-gradient(90deg, var(--pw-bg) 22%, rgba(11, 17, 25, 0.6) 42%, rgba(11, 17, 25, 0) 70%),
      linear-gradient(0deg, var(--pw-bg) 0%, rgba(11, 17, 25, 0) 45%),
      url('/images/dashboard-header.jpg') right 30% / 72% auto no-repeat;
  }
  .welcome h1 { font-size: 2.8rem; }
  .welcome p { margin: 4px 0 0; font-size: 1.2rem; }
  h2 { font-size: 1.8rem; margin: 2px 0; }
  h3 { display: flex; align-items: center; gap: 10px; font-size: 1.3rem; margin: 0 0 12px; }
  h3 :global(svg) { color: var(--pw-primary); }
  .small { font-size: 0.9rem; }
  .muted { color: var(--pw-text-muted); }
  a { color: inherit; text-decoration: none; }
  .course { display: flex; align-items: center; gap: 22px; margin-bottom: 16px; }
  .course:hover { border-color: var(--pw-primary-hover); }
  .tile { width: 84px; height: 84px; border-radius: 16px; display: grid; place-items: center; background: linear-gradient(160deg, #2a8ff0, #1765b8); color: #fff; flex: none; }
  .cmain { flex: 1; min-width: 0; }
  .cmain p { margin: 0 0 10px; }
  .bar { height: 10px; border-radius: 6px; background: var(--pw-surface-2); overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--pw-primary); border-radius: 6px; }
  .cside { display: flex; flex-direction: column; gap: 4px; padding-left: 26px; border-left: 1px solid var(--pw-border); min-width: 190px; }
  .cside b { font-size: 1.25rem; }
  .grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
  .col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .mastery { display: flex; flex-direction: column; gap: 14px; flex: 1; }
  .recent { display: flex; flex-direction: column; flex: 1; }
  .mhead { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .mhead h3 { margin: 0; }
  .due { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: rgba(245, 158, 56, 0.15); border: 1px solid var(--pw-amber); color: var(--pw-amber); font-weight: 700; font-size: 0.88rem; }
  .objective { padding: 12px 14px; border-radius: 12px; background: var(--pw-bg-raised); border: 1px solid var(--pw-border-strong); }
  .objective b { display: block; font-size: 1.15rem; margin: 2px 0 4px; }
  .objective p { margin: 0; }
  .start { display: flex; flex-direction: column; gap: 8px; }
  .start p { margin: 0; }
  .srow { display: flex; align-items: center; gap: 10px; }
  .sname { width: 52px; flex: none; font-weight: 700; color: var(--pw-text-muted); font-size: 0.9rem; }
  .srow ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 6px; flex: 1; }
  .srow li { display: flex; flex-direction: column; align-items: center; padding: 5px 2px; border-radius: 8px; border: 1px solid var(--pw-border-strong); background: var(--pw-surface-2); }
  .srow li b { font-size: 1.05rem; }
  .srow li span { font-size: 0.72rem; color: var(--pw-text-muted); }
  .mstats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .mstats div { display: flex; flex-direction: column; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--pw-border-strong); background: var(--pw-bg-raised); }
  .mstats b { font-size: 1.5rem; }
  .mstats span { color: var(--pw-text-muted); font-size: 0.9rem; }
  .nextskill { display: flex; flex-direction: column; gap: 2px; }
  .nextskill b { font-size: 1.1rem; }
  .mastery .go { margin-top: auto; }
  .note { margin: 10px 0 0; }
  .lastskill { margin: -4px 0 10px; }
  .again { align-self: flex-start; margin-top: auto; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px; border: 1px solid var(--pw-primary); color: var(--pw-text); font-weight: 600; }
  .recent .rp { margin-bottom: 12px; }
  .again:hover { background: var(--pw-surface-2); }
  .soon { font-size: 0.72rem; font-weight: 700; color: var(--pw-amber); text-transform: uppercase; letter-spacing: 0.06em; }
  .next { display: flex; gap: 20px; }
  .photo { position: relative; flex: 0 1 250px; min-width: 140px; }
  .photo img { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; min-height: 180px; display: block; }
  .tag { position: absolute; top: 10px; left: 10px; background: var(--pw-amber); color: #1a1206; font-weight: 800; font-size: 0.8rem; padding: 3px 9px; border-radius: 6px; }
  .ninfo { min-width: 0; flex: 1 1 260px; }
  .ninfo h3 { color: var(--pw-text); font-size: 1.45rem; margin: 2px 0 6px; }
  .ninfo p { margin: 0 0 14px; }
  .go { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 10px; background: var(--pw-amber); color: #1a1206; font-weight: 700; font-size: clamp(0.95rem, 1.1vw, 1.1rem); white-space: nowrap; }
  .go:hover { filter: brightness(1.08); }
  .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .stat { display: flex; flex-direction: column; gap: 2px; padding: 12px; border: 1px solid var(--pw-border-strong); border-radius: 12px; background: var(--pw-bg-raised); }
  .stat b { font-size: 1.4rem; }
  .stat span { color: var(--pw-text-muted); font-size: 0.9rem; }
  .stat :global(svg) { color: var(--pw-primary-hover); }
  .rp { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
  .ring { width: 108px; height: 108px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(closest-side, var(--pw-surface) 80%, transparent 81%), conic-gradient(var(--pw-primary) calc(var(--p) * 100%), var(--pw-surface-2) 0); }
  .ring b { font-size: 1.4rem; }
  .ring span { font-size: 0.8rem; color: var(--pw-text-muted); }
  .rp ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .rp li { display: flex; gap: 8px; align-items: center; }
  .bars { margin-left: auto; display: flex; align-items: flex-end; gap: 6px; height: 80px; position: relative; padding-bottom: 20px; }
  .bars i { width: 16px; background: var(--pw-primary); border-radius: 3px 3px 0 0; min-height: 4px; }
  .bars span { position: absolute; bottom: 0; right: 0; font-size: 0.8rem; color: var(--pw-text-muted); white-space: nowrap; }
  .empty { margin: 4px 0 6px; }
  .qa { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .qa a { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 4px; border: 1px solid var(--pw-border-strong); border-radius: 12px; background: var(--pw-bg-raised); font-size: clamp(0.92rem, 0.95vw, 1.05rem); text-align: center; overflow-wrap: anywhere; }
  .qa a:hover, .qa a:focus-visible { border-color: var(--pw-primary-hover); }
  .qa :global(svg) { color: var(--pw-primary-hover); }

  /* Narrower windows (Android tablets in portrait, split-screen): one column. Windows never gets this. */
  @media (max-width: 839.98px) {
    .grid { grid-template-columns: minmax(0, 1fr); }
    .course { flex-wrap: wrap; }
    .cmain { flex: 1 1 260px; }
    .cside { flex: 1 1 100%; border-left: 0; padding-left: 0; padding-top: 10px; border-top: 1px solid var(--pw-border); }
    .course > :global(svg:last-child) { display: none; }
    .welcome { background-size: auto 100%; }
  }
  /* Phones: stack the course and Try This cards. */
  @media (max-width: 599.98px) {
    .next { flex-direction: column; }
    .photo { width: 100%; height: 160px; }
    .stats { grid-template-columns: minmax(0, 1fr); }
    .qa { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sname { width: 100%; }
    .srow { flex-wrap: wrap; gap: 4px; }
  }
</style>
