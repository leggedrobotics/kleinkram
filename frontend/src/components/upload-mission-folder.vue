<template>
    <div
        :class="{
            disabled: !canCreate,
            'cursor-pointer': !canCreate,
            'cursor-not-allowed': canCreate,
        }"
        @click="createNewMission"
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import NewMissionByFolderDialog from 'src/dialogs/create-mission-from-folder-dialog.vue';
import { canCreateMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed, inject } from 'vue';

const { projectUuid } = defineProps<{ projectUuid?: string | undefined }>();

const $q = useQuasar();

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const uploads = inject('uploads')!;

const { data: permissions } = usePermissionsQuery();
const canCreate = computed(() => {
    if (!projectUuid) return true;
    return canCreateMission(projectUuid, permissions.value);
});

const createNewMission = () => {
    if (!canCreate.value) return;
    $q.dialog({
        title: 'Create new mission',
        component: NewMissionByFolderDialog,
        componentProps: {
            projectUuid: projectUuid,
            uploads,
        },
    });
};
</script>
