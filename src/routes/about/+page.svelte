<script lang="ts">
  const version = '0.1.0';
</script>

<section class="about">
  <img src="/branding/pickworks-logo.png" alt="PickWorks Studio" />
  <div class="card">
    <p><strong>PickWorks Studio</strong> version {version}</p>
    <p class="muted">Interactive guitar education and practice software. Works fully offline; no accounts, ads or analytics.</p>
    <p class="muted">© PickWorks Studio, all rights reserved.</p>
    <p class="muted">Built with Tauri, Svelte and TypeScript. Third-party licenses will be listed here before release.</p>
  </div>
</section>

<style>
  .about {
    max-width: 720px;
  }
  img {
    width: 360px;
    max-width: 100%;
    margin-bottom: 16px;
  }
  p {
    margin: 4px 0;
  }
  .muted {
    color: var(--pw-text-muted);
  }
</style>
