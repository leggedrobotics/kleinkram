<template>
    <title-section :title="`${greeting}, ${user?.name}`" />

    <div class="q-mt-lg q-mb-lg dashboard-grid">
        <DashboardRecentProjects />
        <DashboardStorageIndicator />
        <DashboardWorkerLists />
        <RunningActions />
    </div>
</template>

<script setup lang="ts">
import DashboardRecentProjects from 'components/dashboard/dashboard-recent-projects.vue';
import DashboardStorageIndicator from 'components/dashboard/dashboard-storage-indicator.vue';
import DashboardWorkerLists from 'components/dashboard/dashborad-woker-list.vue';
import RunningActions from 'components/running-actions.vue';
import TitleSection from 'components/title-section.vue';
import { useUser } from 'src/hooks/query-hooks';
import { computed } from 'vue';

const { data: user } = useUser();

const greeting = computed(() => {
    const currentHour = new Date().getHours();

    if (currentHour < 12) {
        return 'Good Morning';
    } else if (currentHour < 18) {
        return 'Good Afternoon';
    } else {
        return 'Good Evening';
    }
});
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
</style>
