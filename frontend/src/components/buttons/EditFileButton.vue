<template>
    <q-btn
        class="button-border"
        flat
        color="primary"
        icon="sym_o_edit"
        label="Edit File"
        :disable="
            [FileState.LOST, FileState.UPLOADING].indexOf(file.state) !== -1 ||
            !canModify
        "
        @click="editFile"
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
import NewEditFile from 'components/NewEditFile.vue';
import { FileState } from '@common/enum';

import { FileWithTopicDto } from '@api/types/files/file.dto';

const $q = useQuasar();
const properties = defineProps<{
    file: FileWithTopicDto;
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    return canModifyMission(
        properties.file.mission.uuid,
        properties.file.mission.project.uuid,
        permissions.value,
    );
});

const editFile = (): void => {
    $q.dialog({
        component: NewEditFile,
        componentProps: {
            file_uuid: properties.file.uuid,
        },
        persistent: true,
    });
};
</script>

<style scoped></style>
