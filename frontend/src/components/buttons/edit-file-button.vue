<template>
    <q-btn
        class="button-border"
        flat
        color="primary"
        icon="sym_o_edit"
        label="Edit File"
        :disable="!isEnabled"
        @click="editFile"
    >
        <q-tooltip v-if="isEnabled"> Edit File</q-tooltip>
        <q-tooltip v-else>
            You do not have permission to edit this file
        </q-tooltip>
    </q-btn>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { canModifyMission, usePermissionsQuery } from '../../hooks/query-hooks';
import { computed } from 'vue';
import { FileState } from '@common/enum';

import { FileWithTopicDto } from '@api/types/files/file.dto';
import EditFile from '../edit-file.vue';

const { file } = defineProps<{ file: FileWithTopicDto }>();

const { data: permissions } = usePermissionsQuery();

const isEnabled = computed(
    () =>
        ![FileState.LOST, FileState.UPLOADING].includes(file.state) &&
        canModifyMission(
            file.mission.uuid,
            file.mission.project.uuid,
            permissions.value,
        ),
);

const $q = useQuasar();

const editFile = (): void => {
    if (!isEnabled.value) return;

    $q.dialog({
        component: EditFile,
        componentProps: {
            fileUuid: file.uuid,
        },
        persistent: true,
    });
};
</script>

<style scoped></style>
