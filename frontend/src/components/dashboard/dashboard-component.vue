<template>
    <div>
        <title-section :title="`${greeting}, ${user?.name}`" />

        <div class="q-mt-lg q-mb-lg dashboard-grid">
            <DashboardRecentProjects />
            <DashboardStorageIndicator />
            <DashboardWorkerLists />
            <RunningActions />
        </div>
    </div>
</template>

<script setup lang="ts">
import RunningActions from 'components/actions/running-actions.vue';
import DashboardRecentProjects from 'components/dashboard/dashboard-recent-projects.vue';
import DashboardStorageIndicator from 'components/dashboard/dashboard-storage-indicator.vue';
import DashboardWorkerLists from 'components/dashboard/dashboard-worker-list.vue';
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
/*
 * Phones (< 600px) stack every panel in a single column. The container turns
 * into a flex column so that the `grid-column: span 2` / `grid-row: span 2`
 * rules the panels declare for the desktop grid are ignored instead of
 * creating implicit columns that would overflow the viewport. The panels then
 * size themselves to their content rather than to a fixed 350px row.
 */
.dashboard-grid {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 16px;
}

.dashboard-grid > * {
    min-width: 0;
}

@media (min-width: 600px) {
    .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-rows: repeat(4, 350px);
        gap: 24px;
    }
}

@media (min-width: 1024px) {
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
