<template>
    <title-section :title="project?.name">
        <template v-slot:subtitle>
            <span>
                {{ project?.description }}
            </span>
        </template>

        <template v-slot:buttons>
            <button-group>
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

                <q-btn icon="sym_o_more_vert" outline>
                    <q-tooltip> More Actions</q-tooltip>

                    <q-menu auto-close style="width: 280px">
                        <q-list>
                            <manage-project-dialog-opener
                                :project_uuid="project_uuid"
                            >
                                <q-item clickable v-close-popup>
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_lock" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-section>
                                            Manage Access
                                        </q-item-section>
                                    </q-item-section>
                                </q-item>
                            </manage-project-dialog-opener>

                            <edit-project-dialog-opener
                                :project_uuid="project_uuid"
                            >
                                <q-item clickable v-close-popup>
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
                                :project_uuid="project_uuid"
                            >
                                <q-item
                                    clickable
                                    v-ripple
                                    style="color: red"
                                    v-close-popup
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_delete" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-section>
                                            Delete Project
                                        </q-item-section>
                                    </q-item-section>
                                </q-item>
                            </DeleteProjectDialogOpener>
                        </q-list>
                    </q-menu>
                </q-btn>
            </button-group>
        </template>
    </title-section>

    <div class="q-my-lg">
        <div class="flex justify-between items-center">
            <h2 class="text-h4 q-mb-xs">All Missions of {{ project?.name }}</h2>

            <button-group>
                <q-input
                    debounce="300"
                    placeholder="Search"
                    dense
                    v-model="search"
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
                    @click="() => refresh()"
                >
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>

                <create-mission-dialog-opener :project_uuid="project_uuid">
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

        <div style="padding-top: 10px">
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
                    :url_handler="handler"
                    v-if="handler"
                />
            </Suspense>
        </div>
    </div>
</template>
<script setup lang="ts">
import { useHandler, useProjectQuery } from 'src/hooks/customQueryHooks';
import { useQueryClient } from '@tanstack/vue-query';
import ButtonGroup from 'components/ButtonGroup.vue';
import TitleSection from 'components/TitleSection.vue';
import { computed } from 'vue';
import ExplorerPageMissionTable from 'components/explorer_page/ExplorerPageMissionTable.vue';
import EditProjectDialogOpener from 'components/buttonWrapper/EditProjectDialogOpener.vue';
import ManageProjectDialogOpener from 'components/buttonWrapper/ManageProjectAccessButton.vue';
import DeleteProjectDialogOpener from 'components/buttonWrapper/DeleteProjectDialogOpener.vue';
import ModifyProjectTagsDialog from 'src/dialogs/ModifyProjectTagsDialog.vue';
import CreateMissionDialogOpener from 'components/buttonWrapper/CreateMissionDialogOpener.vue';
import { useProjectUUID } from 'src/hooks/utils';
import { useQuasar } from 'quasar';
import { logout } from 'src/services/auth';

const queryClient = useQueryClient();
const handler = useHandler();
const $q = useQuasar();
const project_uuid = useProjectUUID();
const { data: project } = useProjectQuery(project_uuid);

const search = computed({
    get: () => handler.value.search_params.name,
    set: (value: string) => {
        handler.value.setSearch({ name: value });
    },
});

function refresh() {
    queryClient.invalidateQueries({
        queryKey: ['missions'],
    });
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
