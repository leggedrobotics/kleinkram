<template>
    <div
        @click="deleteFile"
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': !canModify,
        }"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to delete this file
        </q-tooltip>
    </div>
</template>
<script setup lang="ts">
import { useQuasar } from 'quasar';
import DeleteFileDialog from 'src/dialogs/DeleteFileDialog.vue';
import { FileEntity } from 'src/types/FileEntity';
import {
    canDeleteMission,
    canModifyMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';

const props = defineProps<{
    file: FileEntity;
}>();

const $q = useQuasar();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    if (!props.file) return false;
    return canDeleteMission(
        props.file.mission.uuid,
        props.file.mission.project?.uuid,
        permissions.value,
    );
});

function deleteFile() {
    if (!canModify.value) return;
    $q.dialog({
        title: 'Delete File',
        component: DeleteFileDialog,
        componentProps: {
            file: props.file,
        },
    });
}
</script>

<style scoped></style>
