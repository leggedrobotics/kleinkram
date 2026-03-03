<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 100px; max-width: 500px"
        >
            <h5 v-if="selectedMissions.length === 1">
                Move mission {{ selectedMissions[0]?.name }} to another project
            </h5>
            <h5 v-else>
                Move {{ selectedMissions.length }} missions to another project
            </h5>

            <div class="column q-gutter-y-md q-ma-md">
                <ScopeSelector
                    v-model:project-uuid="selectedProjectUuid"
                    :show-mission="false"
                    :required="true"
                />

                <div class="row justify-end q-gutter-x-sm">
                    <q-btn
                        label="Cancel"
                        flat
                        class="button-border"
                        @click="onDialogCancel"
                    />
                    <q-btn
                        label="OK"
                        color="primary"
                        unelevated
                        :disable="
                            !selectedProjectUuid ||
                            selectedMissions.length === 0 ||
                            isNoopMove
                        "
                        @click="onOk"
                    />
                </div>
            </div>
        </q-card>
    </q-dialog>
</template>

<script setup lang="ts">
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import type { FlatMissionDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import { useQueryClient } from '@tanstack/vue-query';
import ScopeSelector from 'components/common/scope-selector.vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { useScopeSelection } from 'src/composables/use-scope-selection';
import { moveMissions } from 'src/services/mutations/mission';
import { computed, ref } from 'vue';

const { dialogRef, onDialogOK, onDialogCancel, onDialogHide } =
    useDialogPluginComponent();

const properties = defineProps<{
    mission?: MissionWithFilesDto | FlatMissionDto;
    missions?: FlatMissionDto[];
}>();

const selectedMissions = computed<FlatMissionDto[]>(() => {
    if (properties.missions && properties.missions.length > 0) {
        return properties.missions;
    }
    if (properties.mission) {
        return [properties.mission];
    }
    return [];
});

const queryClient = useQueryClient();

const selectedProjectUuid = ref<string | undefined>(
    selectedMissions.value[0]?.project.uuid,
);

const { selectedProject } = useScopeSelection(selectedProjectUuid);
const isNoopMove = computed<boolean>(() => {
    if (!selectedProjectUuid.value || selectedMissions.value.length === 0) {
        return false;
    }

    return selectedMissions.value.every(
        (mission) => mission.project.uuid === selectedProjectUuid.value,
    );
});

async function onOk(): Promise<void> {
    if (!selectedProjectUuid.value || !selectedProject.value) {
        return;
    }
    if (selectedMissions.value.length === 0) return;

    const targetProjectName = selectedProject.value.name;
    const missionUUIDs = selectedMissions.value.map((mission) => mission.uuid);
    const isSingleMission = missionUUIDs.length === 1;
    const missionMessage = isSingleMission
        ? (selectedMissions.value[0]?.name ?? 'mission')
        : `${String(missionUUIDs.length)} missions`;

    const creating = Notify.create({
        group: false,
        message: `Moving ${missionMessage} to project ${targetProjectName}`,
        color: 'grey',
        spinner: true,
        timeout: 4000,
        position: 'bottom',
    });

    try {
        await moveMissions(missionUUIDs, selectedProjectUuid.value);

        creating({
            message: `Moved ${missionMessage} to project ${targetProjectName}`,
            color: 'positive',
            spinner: false,
            timeout: 4000,
        });

        // Invalidate queries to refresh lists
        const cache = queryClient.getQueryCache();
        const filtered = cache
            .getAll()
            .filter(
                (query) =>
                    query.queryKey[0] === 'missions' ||
                    query.queryKey[0] === 'projects',
            );
        await Promise.all(
            filtered.map((query) =>
                queryClient.invalidateQueries({
                    queryKey: query.queryKey,
                }),
            ),
        );

        onDialogOK(selectedProjectUuid.value);
    } catch (error: unknown) {
        creating({
            message: `Error moving ${missionMessage} to project ${targetProjectName}`,
            color: 'negative',
            spinner: false,
            timeout: 4000,
        });
        console.error(error);
        onDialogHide();
    }
}
</script>

<style scoped></style>
