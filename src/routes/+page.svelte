<script lang="ts">
  import Fretboard from '$lib/components/fretboard/Fretboard.svelte';
  import { preferences } from '$lib/stores/preferences.svelte';
</script>

<header class="welcome">
  <h1>Welcome Back!</h1>
  <p>Continue your guitar journey and build fretboard mastery.</p>
</header>

<div class="card notice">
  <div class="eyebrow">Milestone 2</div>
  <p>
    The full dashboard (current course, next mission, progress, recent practice and quick actions) is built in
    Milestone 2, once lessons and progress tracking exist to feed it real numbers.
  </p>
</div>

<section class="card preview">
  <h2>Interactive Fretboard</h2>
  <p class="sub">Notes on the A string, calculated from standard tuning.</p>
  <Fretboard
    leftHanded={preferences.value.display.leftHanded}
    interactive={false}
    focusString={5}
    highlights={[3, 5, 7, 12].map((fret) => ({ string: 5, fret }))}
    label="Preview of notes on the A string"
  />
</section>

<style>
  .welcome {
    position: relative;
    margin: -28px -32px 8px;
    padding: 36px 32px 8px;
    min-height: 168px;
    background:
      linear-gradient(90deg, var(--pw-bg) 30%, rgba(11, 17, 25, 0.55) 60%, rgba(11, 17, 25, 0.1) 100%),
      linear-gradient(0deg, var(--pw-bg) 0%, rgba(11, 17, 25, 0) 40%),
      url('/images/dashboard-header.jpg') right center / auto 100% no-repeat;
  }
  .welcome h1 {
    font-size: 2.8rem;
  }
  .welcome p {
    margin: 4px 0 24px;
    font-size: 1.2rem;
    color: var(--pw-text);
  }
  .notice {
    margin-bottom: 20px;
  }
  .notice p,
  .sub {
    margin: 6px 0 0;
    color: var(--pw-text-muted);
  }
  .preview {
    max-width: 960px;
  }
  .preview h2 {
    font-size: 1.4rem;
  }
  .sub {
    margin-bottom: 12px;
  }
</style>
