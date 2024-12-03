<template>
    <q-table
        v-if="!isLoading"
        v-model:pagination="pagination"
        v-model:selected="selected"
        flat
        bordered
        :rows-per-page-options="[10, 20, 50, 100]"
        :rows="data"
        :columns="explorerPageTableColumns as any"
        row-key="uuid"
        :loading="isLoading"
        wrap-cells
        virtual-scroll
        separator="none"
        selection="multiple"
        @row-click="onRowClick"
        @request="setPagination"
    >
        <template #body-selection="props">
            <q-checkbox
                v-model="props.selected"
                color="grey-8"
                class="checkbox-with-hitbox"
            />
        </template>
        <template #loading>
            <q-inner-loading showing color="primary" />
        </template>

        <template #body-cell-projectaction="props">
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
                                v-ripple
                                clickable
                                @click="(e) => onRowClick(e, props.row)"
                            >
                                <q-item-section>View Missions</q-item-section>
                            </q-item>
                            <EditProjectDialogOpener
                                :project_uuid="props.row.uuid"
                            >
                                <q-item v-ripple clickable>
                                    <q-item-section>
                                        Edit Project
                                    </q-item-section>
                                </q-item>
                            </EditProjectDialogOpener>
                            <ConfigureTagsDialogOpener
                                :project_uuid="props.row.uuid"
                            >
                                <q-item v-ripple clickable>
                                    <q-item-section>
                                        Configure Tags
                                    </q-item-section>
                                </q-item>
                            </ConfigureTagsDialogOpener>

                            <manage-project-dialog-opener
                                :project_uuid="props.row.uuid"
                            >
                                <q-item v-ripple clickable>
                                    <q-item-section>
                                        Manage Access
                                    </q-item-section>
                                </q-item>
                            </manage-project-dialog-opener>
                            <DeleteProjectDialogOpener
                                :project_uuid="props.row.uuid"
                                :has_missions="props.row.missions.length > 0"
                            >
                                <q-item v-ripple clickable>
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
import { QTable } from 'quasar';
import { computed, ref, watch } from 'vue';
import { QueryHandler, TableRequest } from 'src/services/QueryHandler';
import DeleteProjectDialogOpener from 'components/buttonWrapper/DeleteProjectDialogOpener.vue';
import EditProjectDialogOpener from 'components/buttonWrapper/EditProjectDialogOpener.vue';
import ROUTES from 'src/router/routes';
import { useRouter } from 'vue-router';
import ManageProjectDialogOpener from 'components/buttonWrapper/ManageProjectAccessButton.vue';
import ConfigureTagsDialogOpener from 'components/buttonWrapper/ConfigureTagsDialogOpener.vue';
import { explorerPageTableColumns } from './explorer_page_table_columns';
import { useFilteredProjects } from '../../hooks/customQueryHooks';

const properties = defineProps<{
    url_handler: QueryHandler;
}>();

function setPagination(update: TableRequest): void {
    properties.url_handler.setPage(update.pagination.page);
    properties.url_handler.setTake(update.pagination.rowsPerPage);
    properties.url_handler.setSort(update.pagination.sortBy);
    properties.url_handler.setDescending(update.pagination.descending);
}

const pagination = computed(() => {
    return {
        page: properties.url_handler.page,
        rowsPerPage: properties.url_handler.take,
        rowsNumber: properties.url_handler.rowsNumber,
        sortBy: properties.url_handler.sortBy,
        descending: properties.url_handler.descending,
    };
});

const selected = ref([]);

const { data: rawData, isLoading } = useFilteredProjects(
    properties.url_handler.take,
    properties.url_handler.skip,
    properties.url_handler.sortBy,
    properties.url_handler.descending,
    properties.url_handler.searchParams,
);
const data = computed(() => (rawData.value ? rawData.value.projects : []));
const total = computed(() => (rawData.value ? rawData.value.count : 0));

watch(
    () => total.value,
    () => {
        if (data.value && !isLoading.value) {
            // eslint-disable-next-line vue/no-mutating-props
            properties.url_handler.rowsNumber = total.value;
        }
    },
    { immediate: true },
);

const $router = useRouter();

const onRowClick = async (_: Event, row: any) => {
    await $router.push({
        name: ROUTES.MISSIONS.routeName,
        params: {
            project_uuid: row.uuid,
        },
    });
};
</script>
