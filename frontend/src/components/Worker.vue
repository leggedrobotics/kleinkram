<template>
    <q-card class="full-width q-pa-md" flat style="height: 15%">
        <span style="font-size: larger">Device Availability</span>
    </q-card>
    <q-card class="q-pa-md" flat style="height: 30%; width: 50%">
        {{ online.length }} Online
    </q-card>
    <q-card class="q-pa-md" flat style="height: 30%; width: 50%">
        {{ offline.length }} Offline
    </q-card>
</template>
<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { allWorkers } from 'src/services/queries/worker';
import { computed, ComputedRef } from 'vue';
import { Worker } from 'src/types/Worker';

const { data: _worker } = useQuery({
    queryKey: ['worker'],
    queryFn: () => allWorkers(),
    refetchInterval: 10000,
});
const worker: ComputedRef<Worker[]> = computed(() => {
    if (!_worker.value) return [];
    return _worker.value[0];
});
const online = computed(() => worker.value.filter((w) => w.reachable));
const offline = computed(() => worker.value.filter((w) => !w.reachable));
</script>

<style scoped></style>
