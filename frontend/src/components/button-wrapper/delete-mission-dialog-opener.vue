<template>
    <div
        v-if="hasPermission"
        :class="hasFiles ? 'disabled cursor-not-allowed' : 'cursor-pointer'"
        @click="deleteMission"
    >
        <slot />
        <q-tooltip v-if="hasFiles">
            A mission with files cannot be deleted. Delete or move its files
            first.
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import {
    FlatMissionDto,
    MissionWithFilesDto,
} from '@kleinkram/api-dto/types/mission/mission.dto';
import { useQuasar } from 'quasar';
import DeleteMissionDialog from 'src/dialogs/delete-mission-dialog.vue';
import { canDeleteMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

const $q = useQuasar();
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { mission } = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    mission: FlatMissionDto | MissionWithFilesDto;
}>();
const { data: permissions } = usePermissionsQuery();

const fileCount = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return 'filesCount' in mission ? mission.filesCount : mission.files.length;
});

const hasFiles = computed(() => fileCount.value > 0);

// Deleting a mission needs DELETE rights (CanDeleteMission in the backend).
const hasPermission = computed(() =>
    canDeleteMission(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        mission.uuid,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        mission.project.uuid,
        permissions.value,
    ),
);

const deleteMission = (): void => {
    if (!hasPermission.value || hasFiles.value) return;
    $q.dialog({
        title: 'Delete Mission',
        component: DeleteMissionDialog,
        componentProps: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            missionUuid: mission.uuid,
        },
    });
};
</script>
