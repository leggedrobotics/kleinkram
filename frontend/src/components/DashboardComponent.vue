<template>
    <title-section :title="`Good Morning, ${user?.name}`" />

    <div
        class="q-mt-lg"
        style="
            display: inline-grid;
            width: 100%;
            grid-template-columns: auto auto auto auto auto;
            gap: 24px;
            height: 350px;
        "
    >
        <RecentProjects />
        <Storage />
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

const is_authenticated = await isAuthenticated();

const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => getUser(),
    enabled: is_authenticated,
});
</script>
