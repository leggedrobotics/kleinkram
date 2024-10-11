<template>
    <q-btn
        class="button-border"
        flat
        color="primary"
        icon="sym_o_edit"
        label="Edit File"
        @click="editFile"
        :disable="
            [FileState.LOST, FileState.UPLOADING, FileState.MOVING].indexOf(
                file?.state,
            ) !== -1 || !canModify
        "
    >
        <q-tooltip> Edit File</q-tooltip>
    </q-btn>
</template>
<script setup lang="ts">
import { useQuasar } from 'quasar';
import {
    canModifyMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';
import { FileEntity } from 'src/types/FileEntity';
import NewEditFile from 'components/NewEditFile.vue';
import { FileState } from 'src/enums/FILE_ENUM';

const $q = useQuasar();
const props = defineProps<{
    file: FileEntity;
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    if (!props.file) return false;
    return canModifyMission(
        props.file.mission.uuid,
        props.file.mission.project?.uuid,
        permissions.value,
    );
});

function editFile() {
    if (!canModify.value) return;
    $q.dialog({
        component: NewEditFile,
        componentProps: {
            file_uuid: props.file.uuid,
        },
        persistent: true,
    });
}
</script>

<style scoped></style>
