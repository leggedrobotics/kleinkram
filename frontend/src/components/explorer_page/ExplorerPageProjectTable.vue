<template>
    <q-table
        v-if="!isLoading"
        flat
        bordered
        v-model:pagination="pagination"
        v-model:selected="selected"
        :rows-per-page-options="[10, 20, 50, 100]"
        :rows="data"
        :columns="explorer_page_table_columns as any"
        row-key="uuid"
        :loading="isLoading"
        wrap-cells
        virtual-scroll
        separator="none"
        selection="multiple"
        @row-click="onRowClick"
        @request="setPagination"
    >
        <template v-slot:loading>
            <q-inner-loading showing color="primary" />
        </template>

        <template v-slot:body-cell-projectaction="props">
            <q-td :props="props">
                <q-btn
                    flat
                    round
                    dense
                    icon="sym_o_more_vert"
                    unelevated
                    color="primary"
                    class="cursor-pointer"
                    @click.stop
                >
                    <q-menu auto-close>
                        <q-list>
                            <q-item
                                clickable
                                v-ripple
                                @click="(e) => onRowClick(e, props.row)"
                            >
                                <q-item-section>View Missions</q-item-section>
                            </q-item>
                            <EditProjectDialogOpener
                                :project_uuid="props.row.uuid"
                            >
                                <q-item clickable v-ripple>
                                    <q-item-section
                                        >Edit Project
                                    </q-item-section>
                                </q-item>
                            </EditProjectDialogOpener>
                            <q-item
                                clickable
                                v-ripple
                                @click="() => openConfigureTags(props.row.uuid)"
                            >
                                <q-item-section>Configure Tags</q-item-section>
                            </q-item>

                            <manage-project-dialog-opener
                                :project_uuid="props.row.uuid"
                            >
                                <q-item clickable v-ripple>
                                    <q-item-section
                                        >Manage Access
                                    </q-item-section>
                                </q-item>
                            </manage-project-dialog-opener>
                            <DeleteProjectDialogOpener
                                :project_uuid="props.row.uuid"
                            >
                                <q-item clickable v-ripple>
                                    <q-item-section>Delete</q-item-section>
                                </q-item>
                            </DeleteProjectDialogOpener>
                        </q-list>
                    </q-menu>
                </q-btn>
            </q-td>
        </template>
    </q-table>
</template>

<script setup lang="ts">
import { QTable, useQuasar } from 'quasar';
import { computed, ref, watch } from 'vue';
import { explorer_page_table_columns } from 'components/explorer_page/explorer_page_table_columns';
import { QueryHandler, TableRequest } from 'src/services/QueryHandler';
import { useQuery } from '@tanstack/vue-query';
import { filteredProjects } from 'src/services/queries/project';
import DeleteProjectDialogOpener from 'components/buttonWrapper/DeleteProjectDialogOpener.vue';
import EditProjectDialogOpener from 'components/buttonWrapper/EditProjectDialogOpener.vue';
import ModifyProjectTagsDialog from 'src/dialogs/ModifyProjectTagsDialog.vue';
import ROUTES from 'src/router/routes';
import { useRouter } from 'vue-router';
import ManageProjectDialogOpener from 'components/buttonWrapper/ManageProjectAccessButton.vue';

const $q = useQuasar();

const props = defineProps({
    url_handler: {
        type: QueryHandler,
        required: true,
    },
});

function setPagination(update: TableRequest) {
    props.url_handler?.setPage(update.pagination.page);
    props.url_handler?.setTake(update.pagination.rowsPerPage);
    props.url_handler?.setSort(update.pagination.sortBy);
    props.url_handler?.setDescending(update.pagination.descending);
}

const pagination = computed(() => {
    return {
        page: props.url_handler.page,
        rowsPerPage: props.url_handler.take,
        rowsNumber: props.url_handler?.rowsNumber,
        sortBy: props.url_handler?.sortBy,
        descending: props.url_handler?.descending,
    };
});

const queryKey = computed(() => ['projects', props.url_handler?.queryKey]);
const selected = ref([]);

const { data: rawData, isLoading } = useQuery({
    queryKey: queryKey,
    queryFn: () =>
        filteredProjects(
            props.url_handler?.take,
            props.url_handler?.skip,
            props.url_handler?.sortBy,
            props.url_handler?.descending,
            props.url_handler?.search_params,
        ),
});

const data = computed(() => (rawData.value ? rawData.value[0] : []));
const total = computed(() => (rawData.value ? rawData.value[1] : 0));

watch(
    () => total.value,
    () => {
        if (data.value && !isLoading.value) {
            props.url_handler.rowsNumber = total.value;
        }
    },
    { immediate: true },
);

const $router = useRouter();

const onRowClick = async (_: Event, row: any) => {
    $router?.push({
        name: ROUTES.MISSIONS.routeName,
        params: {
            project_uuid: row.uuid,
        },
    });
};

function openConfigureTags(projectUUID: string) {
    $q.dialog({
        component: ModifyProjectTagsDialog,
        componentProps: {
            projectUUID: projectUUID,
        },
    });
}
</script>
