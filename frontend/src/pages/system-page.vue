<template>
    <div>
        <title-section title="System" />

        <div v-if="canView" class="q-mt-lg q-mb-lg system-grid">
            <system-storage-card class="system-grid__storage" />
            <system-running-actions class="system-grid__actions" />
            <system-worker-list class="system-grid__workers" />
        </div>
    </div>
</template>

<script setup lang="ts">
import SystemRunningActions from 'components/system/system-running-actions.vue';
import SystemStorageCard from 'components/system/system-storage-card.vue';
import SystemWorkerList from 'components/system/system-worker-list.vue';
import TitleSection from 'components/title-section.vue';
import { canCreateProject, usePermissionsQuery } from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const { data: permissions, isFetched } = usePermissionsQuery();

/**
 * Storage, workers and running actions describe the shared infrastructure.
 * Only users who may create projects (admins and members of an affiliation
 * group) see them; the backend answers 403 to everyone else.
 */
const canView = computed(() => canCreateProject(permissions.value));

watch(
    [isFetched, canView],
    async ([fetched, allowed]) => {
        if (!fetched || allowed) return;
        await router.replace({
            path: ROUTES.ERROR_403.path,
            query: {
                message:
                    'The System page is only available to members of an affiliation group.',
            },
        });
    },
    { immediate: true },
);
</script>

<style scoped>
/*
 * Phones and tablets stack the panels; from 1024px on the storage and the
 * running actions share the first row and the workers get the full width
 * below them.
 */
.system-grid {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 16px;
}

.system-grid > * {
    min-width: 0;
}

@media (min-width: 600px) {
    .system-grid {
        gap: 24px;
    }

    .system-grid__storage,
    .system-grid__actions {
        height: 350px;
    }
}

@media (min-width: 1024px) {
    .system-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        grid-auto-rows: minmax(350px, auto);
    }

    .system-grid__actions {
        grid-column: span 2;
    }

    .system-grid__workers {
        grid-column: 1 / -1;
    }
}
</style>
