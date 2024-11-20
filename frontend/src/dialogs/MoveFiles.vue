<template>
    <base-dialog ref="dialogRef">
        <template #title>
            Move File{{
                props.files.length === 1 ? ' ' + props.files[0].filename : 's'
            }}</template
        >

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
                                selected.projectUUID = project.uuid;
                                selected.projectName = project.name;
                                dd_open = false;
                                dd_open_2 = true;
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
                                selected.missionUUID = mission.uuid;
                                selected.missionName = mission.name;
                                dd_open_2 = false;
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
                @click="onDialogCancel"
                class="q-mr-sm button-border"
            />
            <q-btn
                label="Save"
                class="bg-button-primary"
                :disable="!selected.missionUUID"
                @click="
                    () => {
                        moveFilesMutation();
                        onDialogOK();
                    }
                "
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';

import { computed, Ref, ref, watch } from 'vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { formatDate, parseDate } from 'src/services/dateFormating';
import { Project } from 'src/types/Project';
import { FileEntity } from 'src/types/FileEntity';
import { fetchFile } from 'src/services/queries/file';
import { filteredProjects } from 'src/services/queries/project';
import { missionsOfProjectMinimal } from 'src/services/queries/mission';
import { moveFiles, updateFile } from 'src/services/mutations/file';
import { Mission } from 'src/types/Mission';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import ConfigureCategories from 'components/ConfigureCategories.vue';

const props = defineProps<{
    mission: Mission;
    files: FileEntity[];
}>();

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
    useDialogPluginComponent();
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
    projectName: props.mission.project?.name || '',
    projectUUID: props.mission.project?.uuid || '',
    missions: [],
    missionName: props.mission.name,
    missionUUID: props.mission.uuid,
});

const projectsReturn = useQuery<[Project[], number]>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name'),
});
const projects = computed(() =>
    projectsReturn.data.value ? projectsReturn.data.value[0] : [],
);

const queryKey = computed(() => ['missions', selected.value.projectUUID]);
const { data: _missions } = useQuery<[Mission[], number]>({
    queryKey: queryKey,
    queryFn: () => missionsOfProjectMinimal(selected.value.projectUUID),
});
const missions = computed(() => (_missions.value ? _missions.value[0] : []));

watch(
    () => missions.value,
    (newValue) => {
        if (newValue) {
            selected.value.missions = missions.value.map((mission) => ({
                missionName: mission.name,
                missionUUID: mission.uuid,
            }));
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
    onSuccess: function (data, variables, context) {
        Notify.create({
            group: false,
            message: 'Files moved',
            color: 'positive',
            spinner: false,
            position: 'bottom',
            timeout: 3000,
        });
        queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] === 'files' ||
                query.queryKey[0] === 'missions',
        });
    },
    onError(error, variables, context) {
        console.log(error);
        Notify.create({
            group: false,
            message: 'Error moving file: ' + error.response.data.message,
            color: 'negative',
            spinner: false,
            position: 'bottom',
            timeout: 3000,
        });
    },
});
</script>

<style scoped></style>
