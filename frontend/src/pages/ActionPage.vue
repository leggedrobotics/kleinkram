<template>
    <title-section title="Mission Analysis"></title-section>

    <q-drawer
        side="right"
        v-model="createAction"
        :width="496"
        style="bottom: 0 !important"
        :breakpoint="1000"
        bordered
    >
        <div class="q-pa-lg flex row justify-between" style="height: 84px">
            <h3 class="text-h4 q-ma-none">Submit new Action</h3>
            <q-btn
                flat
                dense
                padding="6px"
                class="button-border"
                icon="sym_o_close"
                @click="() => (createAction = false)"
            />
        </div>

        <q-separator />

        <div class="q-pa-lg">
            <span class="help-text">
                Actions are used to verify mission data or to generate derived
                files.
            </span>

            <!-- Select a project and mission, on which the anylsis will be performed -->
            <q-form
                @submit.prevent="submitAnalysis"
                class="flex column"
                style="margin-top: 24px"
            >
                <span class="text-h5">Basic Information</span>
                <div class="flex column" style="gap: 12px; margin-top: 16px">
                    <div>
                        <label for="action_name">Action Name</label>
                        <q-input
                            v-model="action_name"
                            name="action_name"
                            outlined
                            dense
                            class="q-mb-sm"
                            clearable
                            placeholder="Action Name"
                        />
                    </div>

                    <div>
                        <label for="project">Project</label>
                        <q-select
                            name="project"
                            :model-value="selected_project?.name"
                            placeholder="Project"
                            outlined
                            dense
                            class="q-mb-sm"
                            readonly
                        />
                    </div>
                    <div>
                        <label for="mission">Mission</label>
                        <q-select
                            :model-value="selected_mission?.name"
                            placeholder="Mission"
                            name="mission"
                            outlined
                            dense
                            class="q-mb-sm"
                            readonly
                        />
                    </div>
                </div>
                <span class="text-h5" style="margin-top: 32px"
                    >Define the Action</span
                >
                <div class="flex column" style="gap: 12px; margin-top: 16px">
                    <div>
                        <label for="action_name">Define the Action</label>
                        <q-input
                            name="action_name"
                            v-model="image_name"
                            outlined
                            dense
                            class="q-mb-sm"
                            clearable
                            placeholder="Docker Image"
                        />
                    </div>

                    <div>
                        <label for="action_trigger">Define the Action</label>

                        <q-input
                            name="action_trigger"
                            model-value="Manually Triggered"
                            outlined
                            readonly
                            dense
                            class="q-mb-sm"
                            clearable
                            placeholder="Action Trigger"
                        />
                    </div>

                    <div>
                        <label for="action_command">Command</label>
                        <q-input
                            name="action_command"
                            model-value="Default Entrypoint"
                            outlined
                            readonly
                            dense
                            class="q-mb-sm"
                            clearable
                            placeholder="Command"
                        />
                    </div>
                </div>

                <span class="text-h5" style="margin-top: 32px">
                    Compute Resources
                </span>
                <div
                    class="flex column q-mb-lg"
                    style="gap: 12px; margin-top: 16px"
                >
                    <div>
                        <label for="memory">Memory Allocation</label>
                        <q-select
                            name="memory"
                            model-value="2GB RAM"
                            :options="[]"
                            placholder="Memory Allocation"
                            outlined
                            class="q-mb-sm"
                            readonly
                            dense
                        />
                    </div>
                    <div>
                        <label for="cpu">CPU Core Allocation</label>
                        <q-select
                            name="cpu"
                            model-value="2 Cores"
                            :options="[]"
                            label="CPU Core Allocation"
                            outlined
                            class="q-mb-sm"
                            readonly
                            dense
                        />
                    </div>
                    <div>
                        <label for="gpu">GPU Acceleration</label>
                        <q-select
                            name="gpu"
                            v-model="gpu_model"
                            :options="options"
                            label="GPU Acceleration"
                            class="q-mb-sm"
                            outlined
                            dense
                        />
                    </div>
                </div>

                <q-separator />

                <div class="flex row justify-end q-mt-lg">
                    <q-btn
                        flat
                        @click="submitAnalysis"
                        class="bg-button-secondary text-on-color"
                        label="Submit Action"
                    />
                </div>
            </q-form>
        </div>
    </q-drawer>

    <div class="q-my-lg">
        <div class="flex justify-between items-center">
            <button-group>
                <q-btn-dropdown
                    v-model="dropdownNewFileProject"
                    :label="selected_project?.name || 'Select a Project'"
                    flat
                    class="q-uploader--bordered"
                    clearable
                    required
                >
                    <q-list>
                        <q-item
                            v-for="project in projects"
                            :key="project.uuid"
                            clickable
                            @click="handler.setProjectUUID(project.uuid)"
                        >
                            <q-item-section>
                                <q-item-label>
                                    {{ project.name }}
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
                <q-btn-dropdown
                    v-model="dropdownNewFileMission"
                    :label="selected_mission?.name || 'Select a Mission'"
                    class="q-uploader--bordered"
                    flat
                    clearable
                    required
                >
                    <q-list>
                        <q-item
                            v-for="mission in missions"
                            :key="mission.uuid"
                            clickable
                            @click="handler.setMissionUUID(mission.uuid)"
                        >
                            <q-item-section>
                                <q-item-label>
                                    {{ mission.name }}
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
            </button-group>

            <button-group>
                <q-input
                    debounce="300"
                    placeholder="Search"
                    dense
                    v-model="search"
                    disabled
                    outlined
                >
                    <template v-slot:append>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>

                <q-btn
                    flat
                    dense
                    padding="6px"
                    color="icon-secondary"
                    class="button-border"
                    icon="sym_o_loop"
                    disabled=""
                >
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>

                <q-btn
                    flat
                    class="bg-button-secondary text-on-color"
                    label="Create Action"
                    @click="() => (createAction = true)"
                    icon="sym_o_add"
                />
            </button-group>
        </div>
    </div>

    <div>
        <template v-if="selected_project && selected_mission">
            <ActionsTable :handler="handler"></ActionsTable>
        </template>
        <template v-else>
            <div class="text">Please select a project and a mission to...</div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { useQuery } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import ActionsTable from 'components/Actions.vue';
import { Project } from 'src/types/Project';
import { Mission } from 'src/types/Mission';
import { filteredProjects } from 'src/services/queries/project';
import { missionsOfProject } from 'src/services/queries/mission';
import { createAnalysis } from 'src/services/mutations/action';
import ButtonGroup from 'components/ButtonGroup.vue';
import { useHandler } from 'src/hooks/customQueryHooks';
import TitleSection from 'components/TitleSection.vue';

const search = ref('');
const createAction = ref(false);

const action_name = ref('');
const image_name = ref('rslethz/action:latest');
const options = [
    { label: 'no GPU', value: 'no-gpu' },
    { label: 'GPU needed', value: 'GPU needed' },
];
const gpu_model = ref(options[0]);

const dropdownNewFileProject = ref(false);
const dropdownNewFileMission = ref(false);

const handler = useHandler();

const selected_project = computed(() =>
    projects.value.find(
        (project: Project) => project.uuid === handler.value.project_uuid,
    ),
);

const selected_mission = computed(() =>
    missions.value.find(
        (mission: Mission) => mission.uuid === handler.value.mission_uuid,
    ),
);

// Fetch projects
const projectsReturn = useQuery<[Project[], number]>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name', false),
});
const projects = computed(() =>
    projectsReturn.data.value ? projectsReturn.data.value[0] : [],
);

// Fetch missions
const queryKeyMissions = computed(() => [
    'missions',
    handler.value.project_uuid,
]);
const { data: _missions } = useQuery<[Mission[], number]>({
    queryKey: queryKeyMissions,
    queryFn: () => missionsOfProject(handler.value.project_uuid || '', 500, 0),
});
const missions = computed(() => (_missions.value ? _missions.value[0] : []));

const submitAnalysis = () => {
    console.log(
        `Submit new action: ${selected_project.value?.uuid}, ${selected_mission.value?.uuid}, ${image_name.value}`,
    );

    // validate input (this will also be performed on the backend)
    // the user must select a project and a mission
    // the image name must start with 'rslethz/'
    if (!selected_project.value || !selected_mission.value) {
        Notify.create({
            group: false,
            message: 'Please select a project and a mission',
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
        return;
    }

    if (!image_name.value.startsWith('rslethz/')) {
        Notify.create({
            group: false,
            message: 'The image name must start with "rslethz/"',
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
        return;
    }

    // post: the input should be valid now

    // send the action request to the backend and show a notification
    createAnalysis({
        action_name: action_name.value,
        docker_image: image_name.value,
        mission_uuid: selected_mission.value.uuid,
        gpu_model: gpu_model.value.value,
    })
        .then(() => {
            Notify.create({
                group: false,
                message: 'Analysis submitted',
                color: 'positive',
                position: 'bottom',
                timeout: 2000,
            });
        })
        .catch((error) => {
            Notify.create({
                group: false,
                message: `Error: ${error}`,
                color: 'negative',
                position: 'bottom',
                timeout: 2000,
            });
        });
};
</script>
