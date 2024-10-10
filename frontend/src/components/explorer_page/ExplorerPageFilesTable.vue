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
        <template v-slot:body-cell-state="props">
            <q-td :props="props">
                <q-icon
                    :name="getIcon(props.row.state)"
                    :color="getColorFileState(props.row.state)"
                    size="20px"
                >
                    <q-tooltip>{{ getTooltip(props.row.state) }}</q-tooltip>
                </q-icon>
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
                />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
                />
            </q-td>
        </template>
        <template v-slot:body-cell-cats="props">
            <q-td :props="props">
                <q-chip
                    v-for="cat in props.row.categories"
                    :key="cat.uuid"
                    :label="cat.name"
                    :color="hashUUIDtoColor(cat.uuid)"
                    style="color: white"
                    dense
                    class="q-mr-sm"
                    @mousedown.stop="() => chipClicked(cat)"
                />
            </q-td>
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
                            <q-item
                                clickable
                                v-ripple
                                @click="
                                    () =>
                                        _downloadFile(
                                            props.row.uuid,
                                            props.row.filename,
                                        )
                                "
                            >
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
import { computed, ref, watch } from 'vue';
import { filesOfMission } from 'src/services/queries/file';
import ROUTES from 'src/router/routes';
import { file_columns } from 'components/explorer_page/explorer_page_table_columns';
import { QueryURLHandler, TableRequest } from 'src/services/QueryHandler';
import { useQuery } from '@tanstack/vue-query';
import DeleteFileDialogOpener from 'components/buttonWrapper/DeleteFileDialogOpener.vue';
import {
    _downloadFile,
    getColorFileState,
    getIcon,
    getTooltip,
    hashUUIDtoColor,
} from 'src/services/generic';
import { useRouter } from 'vue-router';
import { useMissionUUID, useProjectUUID } from 'src/hooks/utils';
import { Category } from 'src/types/Category';

const $emit = defineEmits(['update:selected']);
const $router = useRouter();

const project_uuid = useProjectUUID();
const mission_uuid = useMissionUUID();

const props = defineProps({
    handler: QueryURLHandler,
});

function setPagination(update: TableRequest) {
    props.handler.setPage(update.pagination.page);
    props.handler.setTake(update.pagination.rowsPerPage);
    props.handler.setSort(update.pagination.sortBy);
    props.handler.setDescending(update.pagination.descending);
}

const pagination = computed(() => {
    return {
        page: props.handler.page,
        rowsPerPage: props.handler.take,
        rowsNumber: props.handler.rowsNumber,
        sortBy: props.handler.sortBy,
        descending: false,
    };
});

const selected = ref([]);
const queryKey = computed(() => [
    'files',
    mission_uuid.value,
    props.handler.queryKey,
    props.handler.file_type,
    props.handler?.categories,
]);

const { data: rawData, isLoading } = useQuery({
    queryKey: queryKey,
    queryFn: () =>
        filesOfMission(
            mission_uuid.value,
            props.handler.take,
            props.handler.skip,
            props.handler.file_type,
            props.handler.search_params.name,
            props.handler?.categories,
        ),
});
const data = computed(() => (rawData.value ? rawData.value[0] : []));
const total = computed(() => (rawData.value ? rawData.value[1] : 0));

watch(
    () => total.value,
    () => {
        if (data.value && !isLoading.value) {
            props.handler.rowsNumber = total.value;
        }
    },
    { immediate: true },
);

const onRowClick = async (_: Event, row: any) => {
    $router?.push({
        name: ROUTES.FILE.routeName,
        params: {
            project_uuid: project_uuid.value,
            mission_uuid: mission_uuid.value,
            file_uuid: row.uuid,
        },
    });
};

function chipClicked(cat: Category) {
    console.log(cat.name);
}
watch(
    () => selected.value,
    (newVal) => {
        $emit('update:selected', newVal);
    },
);
</script>
