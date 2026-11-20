<template>
    <div>
        <title-section title="System" />

        <q-banner v-if="isError" class="q-mt-lg bg-white" rounded>
            <template #avatar>
                <q-icon name="sym_o_error" color="negative" />
            </template>
            Could not check your permissions for this page.
            <template #action>
                <q-btn flat no-caps label="Try again" @click="retry" />
            </template>
        </q-banner>

        <template v-else-if="canView">
            <storage-insights class="q-mt-lg" />

            <div class="q-mt-lg q-mb-lg system-grid">
                <system-running-actions class="system-grid__actions" />
                <system-worker-list class="system-grid__workers" />
                <system-settings-card v-if="isAdmin" />
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { UserRole } from '@kleinkram/shared';
import StorageInsights from 'components/system/storage-insights.vue';
import SystemRunningActions from 'components/system/system-running-actions.vue';
import SystemSettingsCard from 'components/system/system-settings-card.vue';
import SystemWorkerList from 'components/system/system-worker-list.vue';
import TitleSection from 'components/title-section.vue';
import { canCreateProject, usePermissionsQuery } from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const {
    data: permissions,
    isSuccess,
    isError,
    refetch,
} = usePermissionsQuery();

/**
 * Storage, workers and running actions describe the shared infrastructure.
 * Only users who may create projects (admins and members of an affiliation
 * group) see them; the backend answers 403 to everyone else.
 */
const canView = computed(() => canCreateProject(permissions.value));
/** Instance-wide settings can only be changed by admins. */
const isAdmin = computed(() => permissions.value?.role === UserRole.ADMIN);

const retry = async (): Promise<void> => {
    await refetch();
};

// only a successful answer that denies access leads to the 403 page; a failed
// request shows the banner above instead
watch(
    [isSuccess, canView],
    async ([succeeded, allowed]) => {
        if (!succeeded || allowed) return;
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
 * Below the storage section: the running actions, the workers and (for
 * admins) the instance settings, each the full width of the page.
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

    .system-grid__actions {
        height: 350px;
    }
}
</style>
