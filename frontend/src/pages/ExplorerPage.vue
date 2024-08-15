<template>
    <h1 class="text-h4 q-mt-xl" style="font-weight: 500">Project Explorer</h1>

    <div class="q-mb-md">
        <div class="flex justify-between q-mv-md">
            <ExplorerPageBreadcrumbs :url_handler="handler" />

            <ButtonGroup v-if="handler.isListingMissions">
                <ManageProjectAccessButton :project_uuid="project_uuid" />
                <q-btn
                    outline
                    color="primary"
                    icon="sym_o_sell"
                    label="Metadata"
                    :disable="!project_uuid"
                    @click="() => openConfigureTags(project_uuid as string)"
                >
                    <q-tooltip> Manage Metadata Tags</q-tooltip>
                </q-btn>
                <DeleteProjectDialogOpener :project="project">
                    <q-btn color="red" outline icon="sym_o_delete">
                        <q-tooltip> Delete the Project</q-tooltip>
                    </q-btn>
                </DeleteProjectDialogOpener>
                <q-btn icon="sym_o_more_horiz" outline disabled>
                    <q-tooltip> More Actions</q-tooltip>
                </q-btn>
            </ButtonGroup>

            <ButtonGroup v-if="handler.isListingFiles">
                <q-btn
                    color="primary"
                    outline
                    icon="sym_o_lock"
                    label="Access Rights"
                >
                    <q-tooltip> Manage Access to the Project</q-tooltip>
                </q-btn>
                <MoveMissionButton v-if="mission" :mission="mission" />
                <q-btn
                    outline
                    color="primary"
                    icon="sym_o_analytics"
                    label="Actions"
                    @click="
                        $router.push({
                            path: ROUTES.ACTION.path,
                            query: {
                                project_uuid: project_uuid,
                                mission_uuid: mission_uuid,
                            },
                        })
                    "
                >
                    <q-tooltip> Analyze Actions</q-tooltip>
                </q-btn>
                <delete-mission-dialog-opener :mission="mission" v-if="mission">
                    <q-btn outline color="red" icon="sym_o_delete"></q-btn>
                </delete-mission-dialog-opener>
                <q-btn icon="sym_o_more_horiz" outline disabled>
                    <q-tooltip> More Actions</q-tooltip>
                </q-btn>
            </ButtonGroup>
        </div>
    </div>

    <q-card
        class="q-pa-md q-mb-md"
        flat
        bordered
        v-if="handler.isListingMissions"
    >
        <q-card-section class="flex justify-between items-center">
            <div>
                <h2 class="text-h5" style="font-weight: bold">
                    {{ project?.name }}
                </h2>
                <span>
                    {{ project?.description }}
                </span>
            </div>

            <div class="flex column q-mb-auto">
                <EditProjectDialogOpener :project_uuid="project_uuid">
                    <q-btn outline icon="sym_o_edit" label="Edit Project">
                        <q-tooltip> Edit Project</q-tooltip>
                    </q-btn>
                </EditProjectDialogOpener>
            </div>
        </q-card-section>
    </q-card>

    <q-card class="q-pa-md q-mb-md" flat bordered v-if="handler.isListingFiles">
        <q-card-section class="flex justify-between items-center">
            <div>
                <h2 class="text-h5" style="font-weight: bold">
                    {{ project?.name }} / {{ mission?.name }}
                </h2>

                <div class="flex">
                    <span
                        v-for="tag in mission?.tags"
                        :key="tag.uuid"
                        class="q-mr-xs"
                    >
                        <q-chip square color="gray">
                            {{ tag.type.name }}: {{ tag.asString() }}
                        </q-chip>
                    </span>
                </div>
            </div>

            <div class="flex column q-mb-auto">
                <q-btn outline icon="sym_o_edit" label="Edit Mission" disable>
                    <q-tooltip> Edit Mission</q-tooltip>
                </q-btn>
            </div>
        </q-card-section>
    </q-card>

    <q-card class="q-pa-md q-mb-xl" flat bordered>
        <q-card-section class="flex justify-between items-center">
            <Suspense>
                <TableHeader :url_handler="handler" v-if="handler" />

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

            <ButtonGroup>
                <q-btn
                    outline
                    @click="() => refresh()"
                    color="grey-8"
                    icon="sym_o_refresh"
                >
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>

                <CreateMissionButton
                    :project_uuid="project_uuid"
                    v-if="handler.isListingMissions"
                >
                    <q-btn color="primary" label="Create Mission" />
                </CreateMissionButton>
                <CreateProjectButton v-if="handler.isListingProjects">
                    <q-btn color="primary" label="Create Project" />
                </CreateProjectButton>

                <CreateFileDialogOpener v-if="handler.isListingFiles">
                    <q-btn color="primary" label="Upload File" />
                </CreateFileDialogOpener>
            </ButtonGroup>
        </q-card-section>

        <q-card-section style="padding-top: 10px">
            <Suspense>
                <TableSearchHeader :url_handler="handler" v-if="handler" />

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
        </q-card-section>

        <q-card-section>
            <Suspense>
                <Component
                    :is="getComponent()"
                    :url_handler="handler"
                    v-if="handler"
                />

                <template #fallback>
                    <div style="width: 100%; height: 645px">
                        <q-skeleton
                            class="q-mr-md q-mb-sm q-mt-sm"
                            style="width: 100%; height: 40px"
                        />

                        <div v-for="i in 20" :key="i" class="q-mt-sm">
                            <q-skeleton
                                class="q-mr-md q-mb-sm"
                                style="width: 100%; height: 20px; opacity: 0.5"
                            />
                        </div>
                    </div>
                </template>
            </Suspense>
        </q-card-section>
    </q-card>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import ExplorerPageBreadcrumbs from 'components/explorer_page/ExplorerPageBreadcrumbs.vue';
import TableHeader from 'components/explorer_page/ExplorerPageTableHeader.vue';
import TableSearchHeader from 'components/explorer_page/ExplorerPageTableSearchHeader.vue';
import {
    useHandler,
    useMissionQuery,
    useProjectQuery,
} from 'src/hooks/customQueryHooks';
import { useQueryClient } from '@tanstack/vue-query';
import ExplorerPageMissionTable from 'components/explorer_page/ExplorerPageMissionTable.vue';
import ExplorerPageProjectTable from 'components/explorer_page/ExplorerPageProjectTable.vue';
import ExplorerPageFilesTable from 'components/explorer_page/ExplorerPageFilesTable.vue';
import MoveMissionButton from 'components/buttons/MoveMissionButton.vue';
import ButtonGroup from 'components/ButtonGroup.vue';
import ManageProjectAccessButton from 'components/buttons/ManageProjectAccessButton.vue';
import CreateMissionButton from 'components/buttonWrapper/CreateMissionDialogOpener.vue';
import CreateProjectButton from 'components/buttonWrapper/CreateProjectDialogOpener.vue';
import ROUTES from 'src/router/routes';
import CreateFileDialogOpener from 'components/buttonWrapper/CreateFileDialogOpener.vue';
import DeleteProjectDialogOpener from 'components/buttonWrapper/DeleteProjectDialogOpener.vue';
import EditProjectDialogOpener from 'components/buttonWrapper/EditProjectDialogOpener.vue';
import DeleteMissionDialogOpener from 'components/buttonWrapper/DeleteMissionDialogOpener.vue';
import { Notify, useQuasar } from 'quasar';
import RouterService from 'src/services/routerService';
import ModifyProjectTagsDialog from 'src/dialogs/ModifyProjectTagsDialog.vue';

const queryClient = useQueryClient();
const handler = useHandler();
const $q = useQuasar();

const project_uuid = computed(() => handler.value.project_uuid);
const mission_uuid = computed(() => handler.value.mission_uuid);

const { data: project } = useProjectQuery(project_uuid);
const { data: mission } = useMissionQuery(
    mission_uuid,
    (error, query) => {
        console.log('errsdfor: ', error);
        Notify.create({
            message: `Error fetching Mission: ${error.response.data.message}`,
            color: 'negative',
            timeout: 2000,
            position: 'top-right',
        });
        handler.value.setMissionUUID(undefined);
        return false;
    },
    200,
);

function refresh() {
    if (handler.value.isListingProjects) {
        queryClient.invalidateQueries({
            queryKey: ['projects'],
        });
    }
    if (handler.value.isListingMissions) {
        queryClient.invalidateQueries({
            queryKey: ['missions', handler.value.project_uuid],
        });
    }
    if (handler.value.isListingFiles) {
        queryClient.invalidateQueries({
            queryKey: ['files', handler.value.mission_uuid],
        });
    }
}

function getComponent() {
    if (handler.value.isListingProjects) {
        return ExplorerPageProjectTable;
    } else if (handler.value.isListingMissions) {
        return ExplorerPageMissionTable;
    } else if (handler.value.isListingFiles) {
        return ExplorerPageFilesTable;
    }
    console.log('No component found');
    return ExplorerPageProjectTable;
}

function openConfigureTags(projectUUID: string) {
    $q.dialog({
        component: ModifyProjectTagsDialog,
        componentProps: {
            projectUUID: projectUUID,
        },
    });
}
</script>
