<template>
    <div
        @click="deleteFile"
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
    >
        <slot />
        <q-tooltip v-if="!canModify && props.mission.files.length === 0">
            You do not have permission to move this mission
        </q-tooltip>
        <q-tooltip v-if="!canModify && props.mission.files.length > 0">
            You cannot delete a mission with files
        </q-tooltip>
    </div>
</template>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import {
    canModifyMission,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed, watch } from 'vue';
import { Mission } from 'src/types/Mission';
import DeleteMissionDialog from 'src/dialogs/DeleteMissionDialog.vue';

const $q = useQuasar();
const props = defineProps<{
    mission: Mission;
}>();
const { data: permissions } = usePermissionsQuery();
const canModify = computed(() => {
    if (props.mission.files.length > 0) {
        return false;
    }
    return canModifyMission(
        props.mission.uuid,
        props.mission.project?.uuid,
        permissions.value,
    );
});

const deleteFile = () => {
    if (!canModify.value) return;
    $q.dialog({
        title: 'Delete File',
        component: DeleteMissionDialog,
        componentProps: {
            mission_uuid: props.mission.uuid,
        },
    });
};
</script>

<style scoped></style>
