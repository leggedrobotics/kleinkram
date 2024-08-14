<template>
    <h1 class="text-h4 q-mt-xl" style="font-weight: 500">
        Verify Mission Data using Actions
    </h1>

    <div class="q-mb-md">
        <div class="flex justify-between q-mv-md">
            <div></div>

            <ButtonGroup>
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
            </ButtonGroup>
        </div>
    </div>

    <q-card class="q-pa-md q-mb-md" flat bordered>
        <q-card-section>
            <h3 class="text-h6">Submit new Mission Analysis</h3>

            <!-- Select a project and mission, on which the anylsis will be performed -->
            <q-form @submit.prevent="submitAnalysis">
                <div class="flex column">
                    <q-input
                        v-model="image_name"
                        outlined
                        dense
                        class="q-mb-sm"
                        clearable
                        label="Docker Image"
                        hint="e.g., rslethz/action:latest"
                    />
                    <div class="flex justify-end">
                        <q-btn
                            label="Submit Action"
                            color="primary"
                            outline
                            @click="submitAnalysis"
                        />
                    </div>
                </div>
            </q-form>
        </q-card-section>
    </q-card>
    <q-card class="q-pa-md q-mb-xl" flat bordered>
        <q-card-section>
            <template v-if="selected_project && selected_mission">
                <ActionsTable :handler="handler"></ActionsTable>
            </template>
            <template v-else>
                <div class="text">
                    Please select a project and a mission to...
                </div>
            </template>
        </q-card-section>
    </q-card>
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

const image_name = ref('');
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
            position: 'top-right',
            timeout: 2000,
        });
        return;
    }

    if (!image_name.value.startsWith('rslethz/')) {
        Notify.create({
            group: false,
            message: 'The image name must start with "rslethz/"',
            color: 'negative',
            position: 'top-right',
            timeout: 2000,
        });
        return;
    }

    // post: the input should be valid now

    // send the action request to the backend and show a notification
    createAnalysis(image_name.value, selected_mission.value.uuid)
        .then(() => {
            Notify.create({
                group: false,
                message: 'Analysis submitted',
                color: 'positive',
                position: 'top-right',
                timeout: 2000,
            });
        })
        .catch((error) => {
            Notify.create({
                group: false,
                message: `Error: ${error}`,
                color: 'negative',
                position: 'top-right',
                timeout: 2000,
            });
        });
};
</script>
