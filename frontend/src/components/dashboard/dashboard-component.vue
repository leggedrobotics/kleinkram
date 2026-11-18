<template>
    <div>
        <title-section :title="`${greeting}, ${user?.name}`" />

        <dashboard-system-status v-if="showSystemStatus" class="q-mt-lg" />

        <div class="q-mt-lg q-mb-lg dashboard-grid">
            <DashboardRecentProjects />
            <DashboardStarredProjects />
        </div>
    </div>
</template>

<script setup lang="ts">
import DashboardRecentProjects from 'components/dashboard/dashboard-recent-projects.vue';
import DashboardStarredProjects from 'components/dashboard/dashboard-starred-projects.vue';
import DashboardSystemStatus from 'components/dashboard/dashboard-system-status.vue';
import TitleSection from 'components/title-section.vue';
import {
    canCreateProject,
    usePermissionsQuery,
    useUser,
} from 'src/hooks/query-hooks';
import { computed } from 'vue';

const { data: user } = useUser();
const { data: permissions } = usePermissionsQuery();

/**
 * Storage, workers and running actions live on the System page, which only
 * members of an affiliation group (users who may create projects) can open.
 * They get a one-line summary here; external users only see their projects.
 */
const showSystemStatus = computed(() => canCreateProject(permissions.value));

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
 * Phones (< 600px) stack the panels in a single column. The container turns
 * into a flex column so that the `grid-column: span 2` rule of the recent
 * projects is ignored instead of creating an implicit column that would
 * overflow the viewport.
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
        grid-auto-rows: 350px;
        gap: 24px;
    }
}

/* recent projects across two columns, starred projects in the third */
@media (min-width: 1024px) {
    .dashboard-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}
</style>
