<template>
    <title-section :title="`Good Morning, ${user?.name}`" />

    <div class="q-mt-lg q-mb-lg dashboard-grid">
        <RecentProjects />
        <Storage />
        <Worker />
        <RunningActions />
    </div>
</template>

<script setup lang="ts">
import TitleSection from 'components/TitleSection.vue';
import { useQuery } from '@tanstack/vue-query';
import { getUser, isAuthenticated } from 'src/services/auth';
import Storage from 'components/Storage.vue';
import RecentProjects from 'components/RecentProjects.vue';
import RunningActions from 'components/RunningActions.vue';
import Worker from 'components/Worker.vue';

const is_authenticated = await isAuthenticated();

const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => getUser(),
    enabled: is_authenticated,
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
