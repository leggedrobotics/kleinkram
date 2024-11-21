<template>
    <q-table
        ref="tableRef"
        v-model:pagination="pagination"
        v-model:selected="selected"
        flat
        bordered
        :rows-per-page-options="[5, 10, 20, 50, 100]"
        :rows="data"
        :columns="fileColumns as any"
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
        <template #body-cell-state="props">
            <q-td :props="props">
                <q-icon
                    :name="getIcon(props.row.state)"
                    :color="getColorFileState(props.row.state)"
                    size="20px"
                >
                    <q-tooltip>{{ getTooltip(props.row.state) }}</q-tooltip>
                </q-icon>
            </q-td>
        </template>
        <template #body-cell-cats="props">
            <q-td :props="props">
                <q-chip
                    v-for="cat in sortedCats(props.row)"
                    :key="cat.uuid"
                    :label="cat.name"
                    :color="hashUUIDtoColor(cat.uuid)"
                    style="color: white"
                    dense
                    clickable
                    class="q-mr-sm"
                    @click.stop="() => chipClicked(cat)"
                />
            </q-td>
        </template>
        <template #body-cell-fileaction="props">
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
                                <q-item-section>View</q-item-section>
                            </q-item>
                            <q-item v-ripple clickable>
                                <q-item-section>
                                    <edit-file-dialog-opener :file="props.row">
                                        Edit
                                    </edit-file-dialog-opener>
                                </q-item-section>
                            </q-item>
                            <q-item
                                v-ripple
                                clickable
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
                            <q-item v-ripple clickable>
                                <q-item-section>
                                    <MoveFileDialogOpener
                                        :files="[props.row]"
                                        :mission="props.row.mission"
                                    >
                                        Move
                                    </MoveFileDialogOpener>
                                </q-item-section>
                            </q-item>
                            <q-item v-ripple clickable>
                                <q-item-section>
                                    <DeleteFileDialogOpener
                                        v-if="props.row"
                                        :file="props.row"
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
import { QueryHandler, TableRequest } from 'src/services/QueryHandler';
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
import EditFileDialogOpener from 'components/buttonWrapper/EditFileDialogOpener.vue';
import MoveFileDialogOpener from 'components/buttonWrapper/MoveFileDialogOpener.vue';
import { fileColumns } from './explorer_page_table_columns';

const $emit = defineEmits(['update:selected']);
const $router = useRouter();

const project_uuid = useProjectUUID();
const mission_uuid = useMissionUUID();

const props = defineProps({
    url_handler: {
        type: QueryHandler,
        required: true,
    },
});

if (props.url_handler.sortBy === 'name') {
    props.url_handler.setSort('filename');
}

function setPagination(update: TableRequest) {
    props.url_handler.setPage(update.pagination.page);
    props.url_handler.setTake(update.pagination.rowsPerPage);
    props.url_handler.setSort(update.pagination.sortBy);
    props.url_handler.setDescending(update.pagination.descending);
}

const pagination = computed(() => {
    return {
        page: props.url_handler.page,
        rowsPerPage: props.url_handler.take,
        rowsNumber: props.url_handler.rowsNumber,
        sortBy: props.url_handler.sortBy,
        descending: props.url_handler.descending,
    };
});

const selected = ref([]);
const queryKey = computed(() => [
    'files',
    mission_uuid.value,
    props.url_handler.queryKey,
    props.url_handler.fileType,
    props.url_handler.categories,
]);

const { data: rawData, isLoading } = useQuery({
    queryKey: queryKey,
    queryFn: () =>
        filesOfMission(
            mission_uuid.value,
            props.url_handler.take,
            props.url_handler.skip,
            props.url_handler.fileType,
            props.url_handler.searchParams.name,
            props.url_handler.categories,
            props.url_handler.sortBy,
            props.url_handler.descending,
            props.url_handler.searchParams.health,
        ),
});
const data = computed(() => (rawData.value ? rawData.value[0] : []));
const total = computed(() => (rawData.value ? rawData.value[1] : 0));

watch(
    () => total.value,
    () => {
        if (data.value && !isLoading.value) {
            // eslint-disable-next-line vue/no-mutating-props
            props.url_handler.rowsNumber = total.value;
        }
    },
    { immediate: true },
);

const onRowClick = async (_: Event, row: any) => {
    await $router.push({
        name: ROUTES.FILE.routeName,
        params: {
            project_uuid: project_uuid.value,
            mission_uuid: mission_uuid.value,
            file_uuid: row.uuid,
        },
    });
};

function chipClicked(cat: Category) {
    props.url_handler.addCategory(cat.uuid);
}

watch(
    () => selected.value,
    (newVal) => {
        $emit('update:selected', newVal);
    },
);

function sortedCats(file: FileEntity) {
    const cats = [...(file.categories || [])];
    return cats.sort((a, b) => a.name.localeCompare(b.name));
}
</script>
