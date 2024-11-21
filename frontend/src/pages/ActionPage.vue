<template>
    <title-section title="Mission Analysis" />

    <ActionConfiguration :open="createAction" @close="createAction = false" />

    <div class="q-my-lg">
        <div class="flex justify-between items-center">
            <button-group>
                <q-btn-dropdown
                    v-model="dropdownNewFileProject"
                    :label="selectedProject?.name || 'Select a Project'"
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
                    :label="selectedMission?.name || 'Select a Mission'"
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
                    v-model="search"
                    debounce="300"
                    placeholder="Search"
                    dense
                    disabled
                    outlined
                >
                    <template #append>
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
                    @click="queryClient.invalidateQueries('actions')"
                >
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>

                <q-btn
                    flat
                    class="bg-button-secondary text-on-color"
                    label="Create Action"
                    :disable="!canCreate"
                    icon="sym_o_add"
                    @click="() => (createAction = true)"
                >
                    <q-tooltip v-if="!canCreate">
                        Creating Actions requires Create rights on the mission.
                    </q-tooltip>
                </q-btn>
            </button-group>
        </div>
    </div>

    <div>
        <template v-if="selectedProject">
            <ActionsTable :handler="handler" />
        </template>
        <template v-else>
            <div class="text">Please select a project and a mission to...</div>
        </template>
    </div>

    <BullQueue v-if="permissions?.role === UserRole.ADMIN" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { useQuery, useQueryClient } from '@tanstack/vue-query';
import ActionsTable from 'components/ActionsTable.vue';
import { filteredProjects } from 'src/services/queries/project';
import { missionsOfProjectMinimal } from 'src/services/queries/mission';
import ButtonGroup from 'components/ButtonGroup.vue';
import {
    canLaunchInMission,
    useHandler,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import TitleSection from 'components/TitleSection.vue';
import ActionConfiguration from 'components/ActionConfiguration.vue';
import BullQueue from 'components/BullQueue.vue';
import { UserRole } from '@common/enum';

const createAction = ref(false);

const queryClient = useQueryClient();

const dropdownNewFileProject = ref(false);
const dropdownNewFileMission = ref(false);

const handler = useHandler();

const { data: permissions } = usePermissionsQuery();
const selectedProject = computed(() =>
    projects.value.find(
        (project: Project) => project.uuid === handler.value.projectUuid,
    ),
);

const selectedMission = computed(() =>
    missions.value.find(
        (mission: Mission) => mission.uuid === handler.value.missionUuid,
    ),
);
const search = computed({
    get: () => handler.value.searchParams.name,
    set: (value) => {
        handler.value.setSearch({ name: value });
    },
});

const canCreate = computed(() =>
    selectedMission.value
        ? canLaunchInMission(selectedMission.value, permissions.value)
        : true,
);

// Fetch projects
const projectsReturn = useQuery<[Project[], number]>({
    queryKey: ['projects', 500, 0, 'name', false],
    queryFn: () => filteredProjects(500, 0, 'name', false),
});
const projects = computed(() =>
    projectsReturn.data.value ? projectsReturn.data.value[0] : [],
);

// Fetch missions
const queryKeyMissions = computed(() => [
    'missions',
    handler.value.projectUuid,
]);
const { data: _missions } = useQuery<[Mission[], number]>({
    queryKey: queryKeyMissions,
    queryFn: () =>
        missionsOfProjectMinimal(handler.value.projectUuid || '', 500, 0),
});
const missions = computed(() => (_missions.value ? _missions.value[0] : []));
</script>
