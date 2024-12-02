<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': !canModify,
        }"
        @click="deleteFile"
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
import {
    canDeleteMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';
import { FileDto } from '@api/types/Files.dto';

const props = defineProps<{
    file: FileDto;
}>();

const $q = useQuasar();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    if (!props.file) return false;
    return canDeleteMission(
        props.file.mission.uuid,
        props.file.mission.project.uuid,
        permissions.value,
    );
});

const deleteFile = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        title: 'Delete File',
        component: DeleteFileDialog,
        componentProps: {
            file: props.file,
        },
    });
};
</script>

<style scoped></style>
