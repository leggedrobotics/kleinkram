<template>
    <title-section
        :title="handler.isListingFiles ? mission?.name : project?.name"
    >
        <template v-slot:subtitle>
            <div>
                <div class="flex justify-between items-center">
                    <div>
                        <div class="flex">
                            <span
                                v-for="tag in mission?.tags"
                                :key="tag.uuid"
                                class="q-mr-xs"
                            >
                                <q-chip square color="gray">
                                    {{ tag.type.name }}:
                                    {{ tag.asString() }}
                                </q-chip>
                            </span>
                        </div>
                    </div>

                    <div class="flex column q-mb-auto">
                        <q-btn
                            outline
                            icon="sym_o_edit"
                            label="Edit Mission"
                            disable
                        >
                            <q-tooltip> Edit Mission</q-tooltip>
                        </q-btn>
                    </div>
                </div>
            </div>
        </template>

        <template v-slot:buttons>
            <div>
                <button-group>
                    <q-btn
                        color="primary"
                        outline
                        icon="sym_o_lock"
                        label="Access Rights"
                    >
                        <q-tooltip> Manage Access to the Project</q-tooltip>
                    </q-btn>
                    <move-mission-button v-if="mission" :mission="mission" />
                    <q-btn
                        outline
                        color="primary"
                        icon="sym_o_analytics"
                        label="Actions"
                        @click="
                            $router.push({
                                path: ROUTES.ACTION.routeName,
                                query: {
                                    project_uuid: project_uuid,
                                    mission_uuid: mission_uuid,
                                },
                            })
                        "
                    >
                        <q-tooltip> Analyze Actions</q-tooltip>
                    </q-btn>
                    <delete-mission-dialog-opener
                        :mission="mission"
                        v-if="mission"
                    >
                        <q-btn outline color="red" icon="sym_o_delete"></q-btn>
                    </delete-mission-dialog-opener>
                    <q-btn icon="sym_o_more_horiz" outline disabled>
                        <q-tooltip> More Actions</q-tooltip>
                    </q-btn>
                </button-group>
            </div>
        </template>
    </title-section>

    <div class="q-my-lg">
        <div class="flex justify-between items-center">
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
                    flat
                    dense
                    padding="6px"
                    color="icon-secondary"
                    class="button-border"
                    icon="sym_o_refresh"
                    @click="() => refresh()"
                >
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>

                <create-file-dialog-opener :mission="mission">
                    <q-btn color="primary" label="Upload File" />
                </create-file-dialog-opener>
            </ButtonGroup>
        </div>

        <div style="padding-top: 10px">
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
        </div>

        <div>
            <Suspense>
                <ExplorerPageFilesTable :url_handler="handler" v-if="handler" />

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
        </div>
    </div>
</template>

<script setup lang="ts">
import TableHeader from 'components/explorer_page/ExplorerPageTableHeader.vue';
import TableSearchHeader from 'components/explorer_page/ExplorerPageTableSearchHeader.vue';
import {
    useHandler,
    useMissionQuery,
    useProjectQuery,
} from 'src/hooks/customQueryHooks';
import { useQueryClient } from '@tanstack/vue-query';
import ExplorerPageFilesTable from 'components/explorer_page/ExplorerPageFilesTable.vue';
import MoveMissionButton from 'components/buttons/MoveMissionButton.vue';
import ButtonGroup from 'components/ButtonGroup.vue';
import ROUTES from 'src/router/routes';
import CreateFileDialogOpener from 'components/buttonWrapper/CreateFileDialogOpener.vue';
import DeleteMissionDialogOpener from 'components/buttonWrapper/DeleteMissionDialogOpener.vue';
import { Notify } from 'quasar';
import TitleSection from 'components/TitleSection.vue';
import { useMissionUUID, useProjectUUID } from 'src/hooks/utils';

const queryClient = useQueryClient();
const handler = useHandler();

const project_uuid = useProjectUUID();
const mission_uuid = useMissionUUID();

const { data: project } = useProjectQuery(project_uuid);
const { data: mission } = useMissionQuery(
    mission_uuid,
    (error, query) => {
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
    queryClient.invalidateQueries({
        queryKey: ['files', mission_uuid],
    });
}
</script>
