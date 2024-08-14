<template>
    <q-table
        flat
        bordered
        ref="tableRef"
        v-model:pagination="pagination"
        :rows-per-page-options="[5, 10, 20, 50, 100]"
        v-model:selected="selected"
        :rows="data"
        :columns="file_columns as any"
        row-key="uuid"
        :loading="isLoading"
        binary-state-sort
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
        <template v-slot:body-cell-fileaction="props">
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
                                <q-item-section>View</q-item-section>
                            </q-item>
                            <q-item clickable v-ripple disabled>
                                <q-item-section>Download</q-item-section>
                            </q-item>
                            <q-item clickable v-ripple disabled>
                                <q-item-section>Move</q-item-section>
                            </q-item>
                            <q-item clickable v-ripple>
                                <q-item-section>
                                    <DeleteFileDialogOpener
                                        :file="props.row"
                                        v-if="props.row"
                                    >
                                        Delete File
                                    </DeleteFileDialogOpener>
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-btn>
            </q-td>
        </template>
    </q-table>
</template>

<script setup lang="ts">
import { QTable } from 'quasar';
import { computed, inject, ref, watch } from 'vue';

import RouterService from 'src/services/routerService';
import { filesOfMission } from 'src/services/queries/file';
import ROUTES from 'src/router/routes';
import { file_columns } from 'components/explorer_page/explorer_page_table_columns';
import { QueryHandler, TableRequest } from 'src/services/URLHandler';
import { useQuery } from '@tanstack/vue-query';
import DeleteFileDialogOpener from 'components/buttonWrapper/DeleteFileDialogOpener.vue';

const $routerService: RouterService | undefined = inject('$routerService');

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
        descending: false,
    };
});

const selected = ref([]);
const queryKey = computed(() => [
    'files',
    props.url_handler.mission_uuid,
    props.url_handler?.queryKey,
    props.url_handler.file_type,
]);

const { data: rawData, isLoading } = useQuery({
    queryKey: queryKey,
    queryFn: () =>
        filesOfMission(
            props.url_handler.mission_uuid as string,
            props.url_handler?.take,
            props.url_handler?.skip,
            props.url_handler.file_type,
            props.url_handler?.search_params.name,
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

const onRowClick = async (_: Event, row: any) => {
    $routerService?.routeTo(ROUTES.FILE, { uuid: row.uuid });
};
</script>
