<template>
    <title-section :title="`Good Morning, ${user?.name}`" />

    <div class="q-mt-lg q-mb-lg dashboard-grid">
        <RecentProjects />
        <StorageIndicator />
        <WorkerList />
        <RunningActions />
    </div>
</template>

<script setup lang="ts">
import TitleSection from 'components/TitleSection.vue';
import { useQuery } from '@tanstack/vue-query';
import { getUser, isAuthenticated } from 'src/services/auth';
import StorageIndicator from 'components/StorageIndicator.vue';
import RecentProjects from 'components/RecentProjects.vue';
import RunningActions from 'components/RunningActions.vue';
import WorkerList from 'components/WorkerList.vue';

const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => getUser(),
    enabled: await isAuthenticated(),
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

/* used in the child components */
.dashboard-card {
    border-radius: 3px;
    border: solid 1.5px #e0e0e0;
}
</style>
