<template>
    <div class="q-pa-md">
        <!-- Top row with Device Availability -->
        <q-card class="full-width q-pa-md" flat>
            <span style="font-size: larger">Device Availability</span>
        </q-card>

        <!-- Flexbox row with two columns (online and offline) -->
        <div class="row-container q-mt-xs">
            <q-card flat class="flex-card">
                <div class="q-pa-md">{{ online.length }} Online</div>
            </q-card>
            <q-card flat class="flex-card">
                <div class="q-pa-md">{{ offline.length }} Offline</div>
            </q-card>
        </div>

        <div class="q-mt-xs">
            <q-card
                class="full-width q-pa-md row-container"
                flat
                v-for="singleWorker in worker"
                :key="singleWorker.hostname"
            >
                <div
                    class="row-container"
                    style="align-items: center; width: 100%"
                >
                    <q-icon name="sym_o_dns" size="20px" />
                    <span class="worker-name">{{ singleWorker.hostname }}</span>

                    <q-icon
                        name="sym_o_developer_board"
                        size="20px"
                        :class="singleWorker.hasGPU ? '' : 'crossed-out'"
                    >
                        <q-tooltip>
                            {{ singleWorker.hasGPU ? 'Has GPU' : 'No GPU' }}
                        </q-tooltip>
                    </q-icon>

                    <span
                        class="worker-status"
                        :style="
                            singleWorker.reachable
                                ? 'color: green'
                                : 'color: red'
                        "
                        >{{
                            singleWorker.reachable ? 'Online' : 'Offline'
                        }}</span
                    >
                </div>
            </q-card>
        </div>
    </div>
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

<style scoped>
.row-container {
    display: flex;
    gap: 4px; /* Add spacing between elements */
    justify-content: space-between;
}

.worker-name {
    flex: 1; /* Ensures names take equal space */
    margin-left: 8px;
}

.worker-status {
    margin-left: auto; /* Align status to the far right */
    padding-left: 8px; /* Add space between the icon and status */
}

.flex-card {
    flex: 1;
}

.crossed-out {
    position: relative;
}

.crossed-out::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    background-color: red; /* You can adjust the color */
    transform: rotate(-45deg);
}
</style>
