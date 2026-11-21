<script lang="ts">
  import PlannedScreen from '$lib/components/ui/PlannedScreen.svelte';
</script>

<PlannedScreen title="Administration Dashboard" milestone="F" summary="An overview of this installation: students, recent activity and backup status." items={['Student summary and recent sign-ins', 'Last backup and data checks', 'Recent audit log entries']} />
