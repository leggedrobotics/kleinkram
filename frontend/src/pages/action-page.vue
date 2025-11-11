<template>
    <title-section title="Mission Analysis" />

    <ActionConfiguration :open="createAction" @close="closeHandler" />

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
                            @click="() => handler.setProjectUUID(project.uuid)"
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
                            @click="() => handler.setMissionUUID(mission.uuid)"
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
                    @click="refetchData"
                >
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>

                <q-btn
                    flat
                    class="bg-button-secondary text-on-color"
                    label="Create Action"
                    :disable="!canCreate"
                    icon="sym_o_add"
                    @click="createActionEvent"
                >
                    <q-tooltip v-if="!canCreate">
                        Creating Actions requires Create rights on the mission.
                    </q-tooltip>
                </q-btn>
            </button-group>
        </div>
    </div>

    <div>
        <template v-if="selectedProject && selectedMission">
            <ActionsTable :handler="handler" />
        </template>
        <template v-else>
            <q-card flat bordered class="q-pa-lg q-mt-lg">
                <q-card-section class="text-center">
                    <q-icon name="sym_o_analytics" size="64px" color="grey-6" />

                    <div class="text-h6 q-mt-md">
                        <span v-if="!selectedProject"> Kleinkram Actions </span>
                        <span v-else> Select a Mission </span>
                    </div>

                    <p class="text-body1 text-grey-8 q-mt-sm">
                        <span v-if="!selectedProject">
                            Please select a <strong>Project</strong> from the
                            dropdown above to begin.
                        </span>
                        <span v-else-if="!selectedMission">
                            Please select a <strong>Mission</strong> to view its
                            actions or create a new one.
                        </span>
                    </p>
                </q-card-section>

                <q-separator class="q-my-md" />

                <!-- link to the documentation for a guide to create a custom action -->
                <q-card-section class="text-center">
                    <q-btn
                        flat
                        color="primary"
                        label="Learn how to create custom actions"
                        href="https://docs.datasets.dev.leggedrobotics.com/usage/actions/getting-started.html"
                        target="_blank"
                        rel="noopener"
                        icon="sym_o_open_in_new"
                    />
                </q-card-section>
            </q-card>
        </template>
    </div>
    <BullQueue v-if="showBullQueue" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { FlatMissionDto, MissionsDto } from '@api/types/mission/mission.dto';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import {
    canLaunchInMission,
    useHandler,
    usePermissionsQuery,
} from 'src/hooks/query-hooks';
import { missionsOfProjectMinimal } from 'src/services/queries/mission';
import { filteredProjects } from 'src/services/queries/project';

import { ProjectWithMissionCountDto } from '@api/types/project/project-with-mission-count.dto';
import { ProjectsDto } from '@api/types/project/projects.dto';
import { UserRole } from '@common/enum';
import ActionConfiguration from 'components/action-configuration.vue';
import ActionsTable from 'components/actions-table.vue';
import BullQueue from 'components/bull-queue.vue';
import ButtonGroup from 'components/buttons/button-group.vue';
import TitleSection from 'components/title-section.vue';

const createAction = ref(false);

const queryClient = useQueryClient();

const dropdownNewFileProject = ref(false);
const dropdownNewFileMission = ref(false);

const handler = useHandler();

const showBullQueue = computed(
    () => permissions.value?.role === UserRole.ADMIN,
);

const { data: permissions } = usePermissionsQuery();

// Fetch projects
const projectsReturn = useQuery<ProjectsDto>({
    queryKey: ['projects', 500, 0, 'name', false],
    queryFn: () => filteredProjects(500, 0, 'name', false),
});
const projects = computed(() =>
    projectsReturn.data.value ? projectsReturn.data.value.data : [],
);

// Fetch missions
const queryKeyMissions = computed(() => [
    'missions',
    handler.value.projectUuid,
]);
const { data: _missions } = useQuery<MissionsDto>({
    queryKey: queryKeyMissions,
    queryFn: () =>
        missionsOfProjectMinimal(handler.value.projectUuid ?? '', 500, 0),
});
const missions = computed(() =>
    _missions.value === undefined ? [] : _missions.value.data,
);

const selectedProject = computed(() =>
    projects.value.find(
        (project: ProjectWithMissionCountDto) =>
            project.uuid === handler.value.projectUuid,
    ),
);

const selectedMission = computed(() =>
    missions.value.find(
        (mission: FlatMissionDto) => mission.uuid === handler.value.missionUuid,
    ),
);

watch(selectedMission, async () => {
    await queryClient.invalidateQueries({
        queryKey: ['action_mission'],
    });
});

watch(selectedProject, async () => {
    await queryClient.invalidateQueries({
        queryKey: ['action_mission'],
    });
});

const search = computed({
    get: () => handler.value.searchParams.name,
    set: (value) => {
        // @ts-ignore
        handler.value.setSearch({ name: value });
    },
});

const canCreate = computed(() =>
    selectedMission.value
        ? canLaunchInMission(
              selectedMission.value.uuid,
              selectedProject.value?.uuid,
              permissions.value,
          )
        : true,
);

const createActionEvent = (): void => {
    createAction.value = true;
};

const refetchData = async (): Promise<void> => {
    await queryClient.invalidateQueries({
        queryKey: ['action_mission'],
    });
};

const closeHandler = (): void => {
    createAction.value = false;
};
</script>
