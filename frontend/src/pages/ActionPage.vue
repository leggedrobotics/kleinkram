<template>
    <q-page class="flex">
        <div class="q-pa-md">
            <div class="text-h4">Mission Analysis</div>
            <p>
                <i>Actions</i> allows you to perform automated action, tests and
                checks on a project or mission level. Actions works similar to
                GitHub Actions or GitLab CI/CD pipelines. The action is
                performed in a docker container, which gets executed on the
                server. All you have to do is to specify the docker image, which
                contains the action code. The action code will be executed in
                the docker container, the results will be stored, and can be
                viewed via Webinterface.
            </p>

            <h3 class="text-h6">Submit new Mission Analysis</h3>

            <!-- Select a project and mission, on which the anylsis will be performed -->
            <q-form @submit.prevent="submitAnalysis">
                <div class="row items-center justify-between q-gutter-md">
                    <div class="col-1">
                        <q-btn-dropdown
                            v-model="dropdownNewFileProject"
                            :label="selected_project?.name || 'Project'"
                            outlined
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
                                        selected_project = project;
                                        dropdownNewFileProject = false;
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
                    <div class="col-1">
                        <q-btn-dropdown
                            v-model="dropdownNewFileMission"
                            :label="selected_mission?.name || 'Mission'"
                            outlined
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
                                        selected_mission = mission;
                                        dropdownNewFileMission = false;
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
                    <div class="col-5">
                        <div class="row">
                            <q-input
                                v-model="image_name"
                                outlined
                                dense
                                clearable
                                label="Docker Image"
                                hint="e.g., rslethz/action:latest"
                            />
                        </div>
                    </div>
                    <div class="col-1">
                        <q-btn
                            label="Submit"
                            color="primary"
                            @click="submitAnalysis"
                        />
                    </div>
                </div>
            </q-form>

            <template v-if="selected_project && selected_mission">
                <Action
                    :project_uuid="selected_project?.uuid"
                    :mission_uuid="selected_mission?.uuid"
                ></Action>
            </template>
            <template v-else>
                <q-card class="q-pa-sm q-ma-lg text-center">
                    <div class="text">
                        Please select a project and a mission to...
                    </div>
                </q-card>
            </template>
        </div>
    </q-page>
</template>

<script setup lang="ts">
import { computed, Ref, ref, watchEffect } from 'vue';

import { useQuery } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import Action from 'components/Actions.vue';
import { Project } from 'src/types/Project';
import { Mission } from 'src/types/Mission';
import { filteredProjects } from 'src/services/queries/project';
import { missionsOfProject } from 'src/services/queries/mission';
import { createAnalysis } from 'src/services/mutations/action';

const image_name = ref('');
const dropdownNewFileProject = ref(false);
const dropdownNewFileMission = ref(false);
const selected_project: Ref<Project | null> = ref(null);
const selected_mission: Ref<Mission | null> = ref(null);

const { data: _projects } = useQuery<[Project[], number]>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name'),
});
const projects = computed(() => (_projects.value ? _projects.value[0] : []));

const { data: _missions, refetch } = useQuery<[Mission[], number]>({
    queryKey: ['missions', selected_project.value?.uuid],
    queryFn: () =>
        missionsOfProject(selected_project.value?.uuid || '', 100, 0),
    enabled: !!selected_project.value?.uuid,
});

const missions = computed(() => (_missions.value ? _missions.value[0] : []));

watchEffect(() => {
    if (selected_project.value?.uuid) {
        refetch();
    }
});

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
