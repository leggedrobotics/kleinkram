<template>
    <title-section title="Mission Analysis"></title-section>

    <ActionConfiguration :open="createAction" @close="createAction = false" />

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
                    :disable="!canCreate"
                    icon="sym_o_add"
                >
                    <q-tooltip v-if="!canCreate">
                        Creating Actions requires Create rights on the mission.
                    </q-tooltip>
                </q-btn>
            </button-group>
        </div>
    </div>

    <div>
        <template v-if="selected_project">
            <ActionsTable :handler="handler"></ActionsTable>
        </template>
        <template v-else>
            <div class="text">Please select a project and a mission to...</div>
        </template>
    </div>

    <BullQueue v-if="permissions?.role === ROLE.ADMIN" />
</template>

<script setup lang="ts">
import { computed, Ref, ref, watch } from 'vue';

import { useQuery, useQueryClient } from '@tanstack/vue-query';
import ActionsTable from 'components/Actions.vue';
import { Project } from 'src/types/Project';
import { Mission } from 'src/types/Mission';
import { filteredProjects } from 'src/services/queries/project';
import { missionsOfProject } from 'src/services/queries/mission';
import ButtonGroup from 'components/ButtonGroup.vue';
import {
    canLaunchInMission,
    useHandler,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import TitleSection from 'components/TitleSection.vue';
import { ActionTemplate } from 'src/types/ActionTemplate';
import ActionConfiguration from 'components/ActionConfiguration.vue';
import BullQueue from 'components/BullQueue.vue';
import ROLE from 'src/enums/USER_ROLES';

const search = ref('');
const createAction = ref(false);

const select: Ref<undefined | ActionTemplate> = ref(undefined);
const filter = ref('');
const image_name = ref('rslethz/action:simple-latest');
const options = [
    { label: 'no GPU', value: 'no-gpu' },
    { label: 'GPU needed', value: 'GPU needed' },
];
const queryClient = useQueryClient();

const dropdownNewFileProject = ref(false);
const dropdownNewFileMission = ref(false);

const handler = useHandler();

const { data: permissions } = usePermissionsQuery();
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

const canCreate = computed(() =>
    selected_mission.value
        ? canLaunchInMission(selected_mission.value, permissions.value)
        : true,
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
</script>
