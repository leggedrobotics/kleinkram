<template>
    <div
        class="dashboard-card"
        style="grid-row: span 2; grid-column: span 1; background-color: white"
    >
        <!-- Top row with Device Availability -->
        <q-card class="full-width q-pa-md" flat>
            <span style="font-size: larger">Device Availability</span>
        </q-card>

        <q-separator />

        <!-- Flexbox row with two columns (online and offline) -->
        <div class="row-container q-mt-xs">
            <q-card flat class="flex-card q-my-lg">
                <div class="q-pa-md">{{ online.length }} Online</div>
            </q-card>
            <q-separator vertical />

            <q-card flat class="flex-card q-my-lg">
                <div class="q-pa-md">{{ offline.length }} Offline</div>
            </q-card>
        </div>

        <q-separator />

        <div class="q-mt-xs">
            <template
                v-for="singleWorker in workers"
                :key="singleWorker.hostname"
            >
                <q-card class="full-width q-pa-md" flat>
                    <div
                        class="row-container"
                        style="align-items: center; width: 100%"
                    >
                        <q-btn
                            flat
                            dense
                            @click="() => extendWorker(singleWorker.uuid)"
                        >
                            <q-icon
                                name="sym_o_chevron_right"
                                size="20px"
                                :style="
                                    extendedWorkers[singleWorker.uuid]
                                        ? 'rotate: 90deg'
                                        : ''
                                "
                            />
                        </q-btn>

                        <q-icon
                            name="sym_o_dns"
                            size="20px"
                            @click="extendWorker"
                        />
                        <span class="worker-name">{{
                            singleWorker.hostname
                        }}</span>
                        <q-icon
                            name="sym_o_developer_board"
                            size="20px"
                            :class="
                                singleWorker.gpuMemory > 0 ? '' : 'crossed-out'
                            "
                        >
                            <q-tooltip>
                                {{
                                    singleWorker.gpuMemory > 0
                                        ? 'Has GPU'
                                        : 'No GPU'
                                }}
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
                    <div
                        v-if="extendedWorkers[singleWorker.uuid]"
                        class="row-container"
                        style="
                            align-items: center;
                            width: 100%;
                            padding-left: 30px;
                        "
                    >
                        <div class="row">
                            <div class="q-mt-md col-6">
                                <q-icon name="sym_o_psychology" size="20px" />
                                <span class="worker-name">{{
                                    singleWorker.cpuModel
                                }}</span>
                            </div>
                            <div class="q-mt-md col-3">
                                <q-icon name="sym_o_hub" size="20px" />
                                <span class="worker-name"
                                    >{{ singleWorker.cpuCores }} Cores</span
                                >
                            </div>
                            <div class="q-mt-md col-3">
                                <q-icon name="sym_o_memory" size="20px" />
                                <span class="worker-name"
                                    >{{ singleWorker.cpuMemory }}GB</span
                                >
                            </div>
                            <div
                                v-if="
                                    singleWorker?.gpuModel &&
                                    singleWorker?.gpuMemory &&
                                    singleWorker?.gpuMemory > 0
                                "
                                class="row-container"
                                style="align-items: center; width: 100%"
                            >
                                <div class="q-mt-md">
                                    <q-icon
                                        name="sym_o_developer_board"
                                        size="20px"
                                    />
                                    <span class="worker-name">{{
                                        singleWorker.gpuModel || 'No GPU'
                                    }}</span>
                                </div>
                            </div>
                            <div
                                class="row-container"
                                style="align-items: center; width: 100%"
                            >
                                <div class="q-mt-md">
                                    <q-icon
                                        name="sym_o_hard_disk"
                                        size="20px"
                                    />
                                    <span class="worker-name"
                                        >{{ singleWorker.storage }} GB</span
                                    >
                                </div>
                            </div>
                        </div>
                    </div>
                </q-card>
                <q-separator />
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ComputedRef, ref, watch } from 'vue';
import { useWorkers } from '../../hooks/query-hooks';
import { ActionWorkerDto } from '@api/types/action-workers.dto';

const { data: _workers } = useWorkers();

const workers: ComputedRef<ActionWorkerDto[]> = computed(() => {
    if (!_workers.value?.data) return [];
    return _workers.value.data;
});
const online = computed(() => workers.value.filter((w) => w.reachable));
const offline = computed(() => workers.value.filter((w) => !w.reachable));
const extendedWorkers = ref({} as Record<string, boolean>);
watch(
    () => workers.value,
    () => {
        extendedWorkers.value = workers.value.reduce<Record<string, boolean>>(
            (accumulator, w) => {
                accumulator[w.uuid] = !!extendedWorkers.value[w.uuid];
                return accumulator;
            },
            {},
        );
    },
    { immediate: true },
);

const extendWorker = (uuid: string): void => {
    extendedWorkers.value[uuid] = !extendedWorkers.value[uuid];
};
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
