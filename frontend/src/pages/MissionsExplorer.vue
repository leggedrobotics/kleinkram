<template>
    <title-section :title="project?.name">
        <template v-slot:subtitle>
            <span>
                {{ project?.description }}
            </span>
        </template>

        <template v-slot:buttons>
            <button-group>
                <edit-project-dialog-opener :project_uuid="project_uuid">
                    <q-btn outline icon="sym_o_edit" label="Edit Project">
                        <q-tooltip> Edit Project</q-tooltip>
                    </q-btn>
                </edit-project-dialog-opener>

                <manage-project-access-button :project_uuid="project_uuid" />
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
                <delete-project-dialog-opener :project="project">
                    <q-btn color="red" outline icon="sym_o_delete">
                        <q-tooltip> Delete the Procker ject</q-tooltip>
                    </q-btn>
                </delete-project-dialog-opener>
                <q-btn icon="sym_o_more_horiz" outline disabled>
                    <q-tooltip> More Actions</q-tooltip>
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
                    label="Search"
                    dense
                    v-model="search"
                    outlined
                >
                    <template v-slot:append>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>

                <q-btn
                    outline
                    dense
                    @click="() => refresh()"
                    color="icon-secondary"
                    style="padding: 6px 8px"
                >
                    <q-icon name="sym_o_refresh" />
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>

                <create-mission-dialog-opener :project_uuid="project_uuid">
                    <q-btn color="button-secondary" label="Create Mission" />
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
import ManageProjectAccessButton from 'components/buttons/ManageProjectAccessButton.vue';
import DeleteProjectDialogOpener from 'components/buttonWrapper/DeleteProjectDialogOpener.vue';
import ModifyProjectTagsDialog from 'src/dialogs/ModifyProjectTagsDialog.vue';
import CreateMissionDialogOpener from 'components/buttonWrapper/CreateMissionDialogOpener.vue';
import { useProjectUUID } from 'src/hooks/utils';
import { useQuasar } from 'quasar';

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
