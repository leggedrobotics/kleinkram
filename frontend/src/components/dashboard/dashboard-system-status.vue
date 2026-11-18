<template>
    <q-card flat class="system-status">
        <span class="system-status__title">System</span>

        <span class="system-status__item">
            <q-icon
                name="sym_o_hard_drive"
                size="18px"
                :color="storageWarning ? 'warning' : 'grey-8'"
            />
            {{ storageLabel }}
        </span>

        <span class="system-status__item">
            <q-icon name="sym_o_dns" size="18px" :color="workersColor" />
            {{ workersLabel }}
        </span>

        <span class="system-status__item">
            <q-icon name="sym_o_play_circle" size="18px" color="grey-8" />
            {{ actionsLabel }}
        </span>

        <q-btn
            flat
            dense
            no-caps
            color="primary"
            label="Open System"
            icon-right="sym_o_arrow_forward"
            class="system-status__link"
            :to="ROUTES.SYSTEM.path"
        />
    </q-card>
</template>

<script setup lang="ts">
import { useRunningActions } from 'src/composables/use-actions-queries';
import { useStorageOverview, useWorkers } from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { computed } from 'vue';

/**
 * One line that sums up the System page on the dashboard: storage usage,
 * reachable workers and running actions. Only rendered for users who may see
 * the System page.
 */

const STORAGE_WARNING_THRESHOLD = 0.8;

const { data: storage } = useStorageOverview();
const { data: workers } = useWorkers();
const { data: runningActions } = useRunningActions();

// share of the storage in use, or null while it is unknown
const storageUsage = computed<number | null>(() => {
    const total = storage.value?.totalBytes ?? 0;
    if (!storage.value || total === 0) return null;
    return storage.value.usedBytes / total;
});

const storageWarning = computed(
    () => (storageUsage.value ?? 0) >= STORAGE_WARNING_THRESHOLD,
);

const storageLabel = computed(() =>
    storageUsage.value === null
        ? 'Storage –'
        : `Storage ${Math.round(storageUsage.value * 100).toString()} % used`,
);

/*
 * While a request is loading or after it failed there is no data: show a dash
 * instead of zeros, which would look like a healthy (or empty) system.
 */
const workersLabel = computed(() => {
    const list = workers.value?.data;
    if (!list) return 'Workers –';
    const online = list.filter((worker) => worker.reachable).length;
    return `${online.toString()} / ${list.length.toString()} workers online`;
});

const workersColor = computed(() => {
    const list = workers.value?.data;
    if (!list) return 'grey-8';
    return list.every((worker) => worker.reachable) ? 'positive' : 'warning';
});

const actionsLabel = computed(() => {
    const count = runningActions.value?.count;
    if (count === undefined) return 'Running actions –';
    return count === 1
        ? '1 action running'
        : `${count.toString()} actions running`;
});
</script>

<style scoped>
.system-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 24px;
    padding: 8px 16px;
    background-color: white;
}

.system-status__title {
    font-size: larger;
}

.system-status__item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}

.system-status__link {
    margin-left: auto;
}
</style>
