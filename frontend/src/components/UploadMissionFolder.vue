<template>
    <div
        @click="createNewMission"
        :class="{
            disabled: !canCreate,
            'cursor-pointer': !canCreate,
            'cursor-not-allowed': canCreate,
        }"
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { FileUpload } from 'src/types/FileUpload';
import { computed, inject, Ref } from 'vue';
import {
    canCreateMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import NewMissionByFolderDialog from 'src/dialogs/NewMissionByFolderDialog.vue';

const { project_uuid } = defineProps<{ project_uuid?: string | undefined }>();

const $q = useQuasar();

const uploads = inject('uploads') as Ref<FileUpload[]>;

const { data: permissions } = usePermissionsQuery();
const canCreate = computed(() => {
    if (!project_uuid) return true;
    return canCreateMission(project_uuid, permissions.value);
});

const createNewMission = () => {
    if (!canCreate.value) return;
    $q.dialog({
        title: 'Create new mission',
        component: NewMissionByFolderDialog,
        componentProps: {
            project_uuid: project_uuid,
            uploads,
        },
    });
};
</script>
