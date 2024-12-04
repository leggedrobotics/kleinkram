<template>
    <base-dialog ref="dialogRef">
        <template #title>
            Move File{{
                props.files.length === 1 ? ' ' + props.files[0].filename : 's'
            }}
        </template>

        <template #content>
            <div class="q-mt-md">
                <label for="project">Project</label>
                <q-btn-dropdown
                    v-model="dd_open"
                    :label="selected.projectName || 'Project'"
                    class="button-border full-width"
                    name="project"
                    flat
                    dense
                    clearable
                    required
                >
                    <q-list>
                        <q-item
                            v-for="project in projects"
                            :key="project.uuid"
                            clickable
                            @click="
                                () => {
                                    selected.projectUUID = project.uuid;
                                    selected.projectName = project.name;
                                    dd_open = false;
                                    dd_open_2 = true;
                                }
                            "
                        >
                            <q-item-section>
                                <q-item-label>
                                    {{ project.name }}
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
            </div>
            <div class="q-mt-md">
                <label for="mission">Mission</label>
                <q-btn-dropdown
                    v-model="dd_open_2"
                    :label="selected.missionName || 'Mission'"
                    class="button-border full-width"
                    name="mission"
                    flat
                    dense
                    clearable
                    required
                >
                    <q-list>
                        <q-item
                            v-for="mission in missions"
                            :key="mission.uuid"
                            clickable
                            @click="
                                () => {
                                    selected.missionUUID = mission.uuid;
                                    selected.missionName = mission.name;
                                    dd_open_2 = false;
                                }
                            "
                        >
                            <q-item-section>
                                <q-item-label>
                                    {{ mission.name }}
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
            </div>
        </template>
        <template #actions>
            <q-btn
                label="Cancel"
                flat
                class="q-mr-sm button-border"
                @click="onDialogCancel"
            />
            <q-btn
                label="Save"
                class="bg-button-primary"
                :disable="!selected.missionUUID"
                @click="saveAction"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query';

import { computed, ref, watch } from 'vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { moveFiles } from 'src/services/mutations/file';
import BaseDialog from './base-dialog.vue';
import { FlatMissionDto, MissionDto } from '@api/types/Mission.dto';
import {
    useFilteredProjects,
    useMissionsOfProjectMinimal,
} from '../hooks/customQueryHooks';
import { FileDto } from '@api/types/files/file.dto';

const props = defineProps<{
    mission: MissionDto;
    files: FileDto[];
}>();

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();
const queryClient = useQueryClient();

const dd_open = ref(false);
const dd_open_2 = ref(false);
const selected = ref<{
    projectName: string;
    projectUUID: string;
    missions: { missionName: string; missionUUID: string }[];
    missionName: string;
    missionUUID: string;
}>({
    projectName: props.mission.project.name || '',
    projectUUID: props.mission.project.uuid || '',
    missions: [],
    missionName: props.mission.name,
    missionUUID: props.mission.uuid,
});

const projectsReturn = useFilteredProjects(500, 0, 'name', true, {});

const projects = computed(() =>
    projectsReturn.data.value ? projectsReturn.data.value.data : [],
);

const { data: _missions } = useMissionsOfProjectMinimal(
    selected.value.projectUUID,
    100,
    0,
);
const missions = computed(() =>
    _missions.value ? _missions.value.missions : [],
);

watch(
    () => missions.value,
    (newValue) => {
        if (newValue) {
            selected.value.missions = missions.value.map(
                (mission: FlatMissionDto) => ({
                    missionName: mission.name,
                    missionUUID: mission.uuid,
                }),
            );
        }
    },
    {
        immediate: false,
    },
);

const { mutate: moveFilesMutation } = useMutation({
    mutationFn: () =>
        moveFiles(
            props.files.map((file) => file.uuid),
            selected.value.missionUUID,
        ),
    onSuccess: async () => {
        Notify.create({
            group: false,
            message: 'Files moved',
            color: 'positive',
            spinner: false,
            position: 'bottom',
            timeout: 3000,
        });
        await queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] === 'files' ||
                query.queryKey[0] === 'missions',
        });
    },
    onError(e: unknown) {
        console.log(e);
        Notify.create({
            group: false,
            message: `Error moving file: ${
                (
                    e as {
                        response: {
                            data: { message: string };
                        };
                    }
                ).response.data.message
            }`,
            color: 'negative',
            spinner: false,
            position: 'bottom',
            timeout: 3000,
        });
    },
});

const saveAction = (): void => {
    moveFilesMutation();
    onDialogOK();
};
</script>

<style scoped></style>
