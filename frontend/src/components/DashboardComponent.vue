<template>
    <title-section :title="`Good Morning, ${user?.name}`" />

    <div
        class="q-mt-lg"
        style="
            display: inline-grid;
            width: 100%;
            grid-template-columns: auto auto auto auto auto;
            gap: 24px;
        "
    >
        <q-card style="max-width: 300px" flat v-for="i in 3" :key="i">
            <q-item>
                <q-item-section avatar>
                    <q-skeleton type="QAvatar" />
                </q-item-section>

                <q-item-section>
                    <q-item-label>
                        <q-skeleton type="text" />
                    </q-item-label>
                    <q-item-label caption>
                        <q-skeleton type="text" />
                    </q-item-label>
                </q-item-section>
            </q-item>

            <q-skeleton height="200px" square />

            <q-card-actions align="right" class="q-gutter-md">
                <q-skeleton type="QBtn" />
                <q-skeleton type="QBtn" />
            </q-card-actions>
        </q-card>
        <Storage />
    </div>
</template>

<script setup lang="ts">
import TitleSection from 'components/TitleSection.vue';
import { useQuery } from '@tanstack/vue-query';
import { getUser, isAuthenticated } from 'src/services/auth';
import Storage from 'components/Storage.vue';

const is_authenticated = await isAuthenticated();

const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => getUser(),
    enabled: is_authenticated,
});
</script>
