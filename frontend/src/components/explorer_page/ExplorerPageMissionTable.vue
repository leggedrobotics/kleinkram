<template>
    <q-table
        ref="tableRef"
        v-model:pagination="pagination"
        v-model:selected="selected"
        flat
        bordered
        :rows-per-page-options="[10, 20, 50, 100]"
        :rows="data"
        :columns="missionColumns as any"
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
        <template #body-cell-tagverification="props">
            <q-td :props="props" style="width: 150px">
                <div
                    v-if="missingTags(props.row).length === 0"
                    class="flex items-center"
                >
                    <q-icon
                        name="sym_o_check"
                        color="black"
                        style="
                            border: 1px solid black;
                            border-radius: 50%;
                            margin-right: 5px;
                        "
                        size="15px"
                        round
                    />
                    Complete
                </div>
                <div v-else class="flex items-center" style="color: red">
                    <q-icon
                        name="sym_o_error"
                        color="red"
                        style="margin-right: 5px"
                        size="20px"
                        round
                    />
                    {{ missingTagsText(props.row) }}
                    <q-tooltip>
                        <div
                            v-for="tagType in missingTags(props.row)"
                            :key="tagType.uuid"
                            style="font-size: 14px"
                        >
                            {{ tagType.name }}
                        </div>
                    </q-tooltip>
                </div>
            </q-td>
        </template>
        <template #body-cell-missionaction="props">
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
                                <q-item-section>View Files</q-item-section>
                            </q-item>
                            <EditMissionDialogOpener :mission="props.row">
                                <q-item v-ripple clickable>
                                    <q-item-section>
                                        Edit Mission
                                    </q-item-section>
                                </q-item>
                            </EditMissionDialogOpener>
                            <MissionMetadataOpener :mission="props.row">
                                <q-item v-ripple clickable>
                                    <q-item-section>
                                        Edit Metadata
                                    </q-item-section>
                                </q-item>
                            </MissionMetadataOpener>
                            <MoveMissionDialogOpener :mission="props.row">
                                <q-item v-ripple clickable>
                                    <q-item-section>Move</q-item-section>
                                </q-item>
                            </MoveMissionDialogOpener>
                            <DeleteMissionDialogOpener :mission="props.row">
                                <q-item v-ripple clickable>
                                    <q-item-section>Delete</q-item-section>
                                </q-item>
                            </DeleteMissionDialogOpener>
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
import { missionsOfProject } from 'src/services/queries/mission';
import { missionColumns } from 'components/explorer_page/explorer_page_table_columns';
import { QueryHandler, TableRequest } from 'src/services/QueryHandler';
import { useQuery } from '@tanstack/vue-query';
import DeleteMissionDialogOpener from 'components/buttonWrapper/DeleteMissionDialogOpener.vue';
import ROUTES from 'src/router/routes';
import { useRouter } from 'vue-router';
import { useProjectUUID } from 'src/hooks/utils';
import { useProjectQuery } from 'src/hooks/customQueryHooks';
import MoveMissionDialogOpener from 'components/buttonWrapper/MoveMissionDialogOpener.vue';
import MissionMetadataOpener from 'components/buttonWrapper/MissionMetadataOpener.vue';
import EditMissionDialogOpener from 'components/buttonWrapper/EditMissionDialogOpener.vue';

const $emit = defineEmits(['update:selected']);

const props = defineProps({
    url_handler: {
        type: QueryHandler,
        required: true,
    },
});

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
        descending: false,
    };
});

const project_uuid = useProjectUUID();
const { data: project } = useProjectQuery(project_uuid);

const selected = ref([]);
const queryKey = computed(() => [
    'missions',
    project_uuid,
    props.url_handler.queryKey,
]);

const { data: rawData, isLoading } = useQuery({
    queryKey: queryKey,
    queryFn: () =>
        missionsOfProject(
            project_uuid.value,
            props.url_handler.take,
            props.url_handler.skip,
            props.url_handler.sortBy,
            props.url_handler.descending,
            props.url_handler.searchParams,
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
const $router = useRouter();

const onRowClick = async (_: Event, row: any) => {
    await $router.push({
        name: ROUTES.FILES.routeName,
        params: {
            project_uuid: project_uuid.value,
            mission_uuid: row.uuid as string,
        },
    });
};

function missingTags(row: Mission) {
    const mapped = project.value.requiredTags.map((tagType) => {
        const setTypes = row.tags.map((tag) => tag.type);
        if (!setTypes.find((setType) => setType.uuid === tagType.uuid)) {
            return tagType;
        }
    });
    return mapped.filter((val) => !!val);
}

function missingTagsText(row: Mission) {
    const _missionTags = missingTags(row);
    if (_missionTags.length === 1) {
        return `1 Tag missing`;
    }
    return `${_missionTags.length} Tags missing`;
}

watch(
    () => selected.value,
    (newVal) => {
        $emit('update:selected', newVal);
    },
);
</script>
<style scoped></style>
