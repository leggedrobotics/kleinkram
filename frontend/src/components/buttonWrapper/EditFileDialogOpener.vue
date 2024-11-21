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

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>
