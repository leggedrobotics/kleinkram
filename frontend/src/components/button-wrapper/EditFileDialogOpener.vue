<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': !canModify,
        }"
        @click="editFile"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to modify this project
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import {
    canModifyMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';
import NewEditFile from 'components/NewEditFile.vue';

import { FileDto } from '@api/types/files/file.dto';

const $q = useQuasar();
const properties = defineProps<{
    file: FileDto;
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    if (!properties.file) return false;
    return canModifyMission(
        properties.file.mission.uuid,
        properties.file.mission.project.uuid,
        permissions.value,
    );
});

const editFile = (): void => {
    if (!canModify.value) return;
    $q.dialog({
        component: NewEditFile,
        componentProps: {
            file_uuid: properties.file.uuid,
        },
        persistent: true,
    });
};
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>
