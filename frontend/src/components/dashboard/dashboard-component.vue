<template>
    <title-section :title="`Good Morning, ${user?.name}`" />

    <div class="q-mt-lg q-mb-lg dashboard-grid">
        <DashboardRecentProjects />
        <DashboardStorageIndicator />
        <DashboardWorkerLists />
        <RunningActions />
    </div>
</template>

<script setup lang="ts">
import { useUser } from '../../hooks/query-hooks';
import DashboardWorkerLists from '@components/dashboard/dashborad-woker-list.vue';
import TitleSection from '@components/title-section.vue';
import DashboardRecentProjects from '@components/dashboard/dashboard-recent-projects.vue';
import DashboardStorageIndicator from '@components/dashboard/dashboard-storage-indicator.vue';
import RunningActions from '@components/running-actions.vue';

const { data: user } = useUser();
</script>

<style scoped>
.dashboard-grid {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(4, 350px);
    gap: 24px;
}

@media (min-width: 800px) {
    .dashboard-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        grid-template-rows: repeat(3, 350px);
    }
}

@media (min-width: 1200px) {
    .dashboard-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        grid-template-rows: repeat(2, 350px);
    }
}

/* used in the child components */
.dashboard-card {
    border-radius: 3px;
    border: solid 1.5px #e0e0e0;
}
</style>
