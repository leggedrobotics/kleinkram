<template>
    <title-section :title="project?.name">
        <template #subtitle>
            <span>
                {{ project?.description }}
            </span>
        </template>

        <template #buttons>
            <button-group>
                <ConfigureTagsDialogOpener
                    v-if="projectUuid"
                    :project_uuid="projectUuid"
                >
                    <q-btn
                        class="button-border"
                        flat
                        color="primary"
                        icon="sym_o_sell"
                        label="Metadata"
                        :disable="!projectUuid"
                    />
                </ConfigureTagsDialogOpener>

                <q-btn
                    icon="sym_o_more_vert"
                    class="button-border"
                    flat
                    color="primary"
                >
                    <q-tooltip> More Actions</q-tooltip>

                    <q-menu
                        v-if="projectUuid !== undefined"
                        auto-close
                        style="width: 280px"
                    >
                        <q-list>
                            <change-project-rights-dialog-opener
                                :project-uuid="projectUuid"
                                project-access-uuid=""
                            >
                                <q-item v-close-popup clickable>
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_lock" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-section>
                                            Manage Access
                                        </q-item-section>
                                    </q-item-section>
                                </q-item>
                            </change-project-rights-dialog-opener>

                            <edit-project-dialog-opener
                                :project_uuid="projectUuid"
                            >
                                <q-item v-close-popup clickable>
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_edit" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-section>
                                            Edit Project
                                        </q-item-section>
                                    </q-item-section>
                                </q-item>
                            </edit-project-dialog-opener>
                            <DeleteProjectDialogOpener
                                :project_uuid="projectUuid ?? ''"
                                :has_missions="
                                    (project?.missions?.length ?? 0) > 0
                                "
                            >
                                <q-item
                                    v-ripple
                                    v-close-popup
                                    clickable
                                    style="color: red"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_delete" />
                                    </q-item-section>
                                    <q-item-section>
                                        Delete Project
                                    </q-item-section>
                                </q-item>
                            </DeleteProjectDialogOpener>
                        </q-list>
                    </q-menu>
                </q-btn>
            </button-group>
        </template>
    </title-section>
    <ActionConfiguration
        :open="createAction"
        :mission_uuids="selectedMissionUuids"
        @close="onClose"
    />
    <div>
        <div
            v-if="selectedMissions.length === 0"
            class="q-my-lg flex justify-between items-center"
        >
            <h2 class="text-h4 q-mb-xs">All Missions of {{ project?.name }}</h2>

            <button-group>
                <q-input
                    v-model="search"
                    debounce="300"
                    placeholder="Search"
                    dense
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
                    @click="refresh"
                >
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>
                <UploadMissionFolder :project_uuid="projectUuid">
                    <q-btn
                        flat
                        style="height: 100%"
                        color="icon-secondary"
                        class="button-border"
                        icon="sym_o_drive_folder_upload"
                    />
                </UploadMissionFolder>
                <create-mission-dialog-opener :project_uuid="projectUuid">
                    <q-btn
                        flat
                        style="height: 100%"
                        class="bg-button-secondary text-on-color"
                        label="Create Mission"
                        icon="sym_o_add"
                    />
                </create-mission-dialog-opener>
            </button-group>
        </div>
        <div v-else class="q-py-lg" style="background: #0f62fe">
            <ButtonGroupOverlay>
                <template #start>
                    <div style="margin: 0; font-size: 14pt; color: white">
                        {{ selectedMissions.length }}
                        {{
                            selectedMissions.length === 1
                                ? 'mission'
                                : 'missions'
                        }}
                        selected
                    </div>
                </template>
                <template #end>
                    <KleinDownloadMissions
                        :missions="selectedMissions"
                        style="max-width: 400px"
                    />
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        icon="sym_o_analytics"
                        color="white"
                        @click="openMultiActions"
                    >
                        Actions
                    </q-btn>

                    <q-btn
                        flat
                        dense
                        padding="6px"
                        icon="sym_o_delete"
                        color="white"
                        :disable="selectedMissions.length !== 1"
                        @click="deleteMission"
                    >
                        Delete

                        <q-tooltip v-if="selectedMissions.length !== 1">
                            You can only delete one mission at a time
                        </q-tooltip>
                    </q-btn>
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        icon="sym_o_close"
                        color="white"
                        @click="deselect"
                    />
                </template>
            </ButtonGroupOverlay>
        </div>

        <div>
            <Suspense>
                <template #fallback>
                    <div style="width: 550px; height: 67px">
                        <q-skeleton
                            class="q-mr-md q-mb-sm q-mt-sm"
                            style="width: 300px; height: 20px"
                        />
                        <q-skeleton
                            class="q-mr-md"
                            style="width: 200px; height: 18px"
                        />
                    </div>
                </template>
            </Suspense>
        </div>
        <div>
            <Suspense>
                <explorer-page-mission-table
                    v-model:selected="selectedMissions"
                />
            </Suspense>
        </div>
    </div>
</template>
<script setup lang="ts">
import {
    registerNoPermissionErrorHandler,
    useHandler,
    useProjectQuery,
} from 'src/hooks/customQueryHooks';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref, Ref } from 'vue';
import { useQuasar } from 'quasar';
import DeleteMissionDialog from '../dialogs/delete-mission-dialog.vue';
import { MissionWithFilesDto } from '@api/types/Mission.dto';
import ExplorerPageMissionTable from '../components/explorer-page/ExplorerPageMissionTable.vue';
import KleinDownloadMissions from '../components/cli-links/KleinDownloadMissions.vue';
import ButtonGroupOverlay from '../components/ButtonGroupOverlay.vue';
import CreateMissionDialogOpener from '../components/button-wrapper/CreateMissionDialogOpener.vue';
import UploadMissionFolder from '../components/UploadMissionFolder.vue';
import ButtonGroup from '../components/ButtonGroup.vue';
import ActionConfiguration from '../components/ActionConfiguration.vue';
import EditProjectDialogOpener from '../components/button-wrapper/EditProjectDialogOpener.vue';
import DeleteProjectDialogOpener from '../components/button-wrapper/DeleteProjectDialogOpener.vue';
import ConfigureTagsDialogOpener from '../components/button-wrapper/ConfigureTagsDialogOpener.vue';
import TitleSection from '../components/TitleSection.vue';
import { useProjectUUID } from '../hooks/router-hooks';
import ChangeProjectRightsDialogOpener from '../components/button-wrapper/ChangeProjectRightsDialogOpener.vue';

const queryClient = useQueryClient();
const handler = useHandler();
const $q = useQuasar();
const projectUuid = useProjectUUID();
const { data: project, isLoadingError, error } = useProjectQuery(projectUuid);
const createAction = ref(false);

registerNoPermissionErrorHandler(isLoadingError, projectUuid, 'project', error);

const onClose = (): void => {
    createAction.value = false;
};

const deleteMission = (): void => {
    const mission = selectedMissions.value[0];

    $q.dialog({
        title: 'Delete Mission',
        component: DeleteMissionDialog,
        componentProps: {
            missionUuid: mission.uuid,
        },
    });

    deselect();
};

const selectedMissions: Ref<MissionWithFilesDto[]> = ref([]);

const search = computed({
    get: () => handler.value.searchParams.name,
    set: (value: string) => {
        handler.value.setSearch({ name: value });
    },
});

const selectedMissionUuids = computed(() => {
    return selectedMissions.value.map((mission) => mission.uuid);
});

async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({
        queryKey: ['missions'],
    });
}

function deselect(): void {
    selectedMissions.value = [];
}

function openMultiActions(): void {
    createAction.value = true;
}
</script>
