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
import { Pagination } from '../../services/query-handler';
import { useQuery } from '@tanstack/vue-query';
import ROUTES from 'src/router/routes';
import { useRouter } from 'vue-router';
import { useHandler, useProjectQuery } from '../../hooks/query-hooks';
import { MissionWithFilesDto } from '@api/types/mission.dto';
import { missionColumns } from './explorer-page-table-columns';
import { TagDto } from '@api/types/tags/tags.dto';

import { useProjectUUID } from '../../hooks/router-hooks';
import MoveMissionDialogOpener from '@components/button-wrapper/MoveMissionDialogOpener.vue';
import MissionMetadataOpener from '@components/button-wrapper/MissionMetadataOpener.vue';
import EditMissionDialogOpener from '@components/button-wrapper/EditMissionDialogOpener.vue';
import DeleteMissionDialogOpener from '@components/button-wrapper/DeleteMissionDialogOpener.vue';

const $emit = defineEmits(['update:selected']);

const queryHandler = useHandler();

function setPagination(pagination: Pagination): void {
    queryHandler.value.setPage(pagination.page);
    queryHandler.value.setTake(pagination.rowsPerPage);
    queryHandler.value.setSort(pagination.sortBy);
    queryHandler.value.setDescending(pagination.descending);
}

const pagination = computed({
    get: () => ({
        page: queryHandler.value.page,
        rowsPerPage: queryHandler.value.take,
        rowsNumber: queryHandler.value.rowsNumber,
        sortBy: queryHandler.value.sortBy,
        descending: false,
    }),
    set: (value: Pagination) => {
        setPagination(value);
    },
});

const projectUuid = useProjectUUID();
const { data: project } = useProjectQuery(projectUuid);

const selected = ref([]);
const queryKey = computed(() => [
    'missions',
    projectUuid,
    queryHandler.value.queryKey,
]);

const { data: rawData, isLoading } = useQuery({
    queryKey: queryKey,
    queryFn: () =>
        missionsOfProject(
            projectUuid.value ?? '',
            queryHandler.value.take,
            queryHandler.value.skip,
            queryHandler.value.sortBy,
            queryHandler.value.descending,
            queryHandler.value.searchParams as { name: string },
        ),
});

const data = computed(() => (rawData.value ? rawData.value.data : []));
const total = computed(() => (rawData.value ? rawData.value.count : 0));

watch(
    () => total.value,
    () => {
        if (data.value && !isLoading.value) {
            queryHandler.value.rowsNumber = total.value;
        }
    },
    { immediate: true },
);
const $router = useRouter();

const onRowClick = async (_: Event, row: any) => {
    await $router.push({
        name: ROUTES.FILES.routeName,
        params: {
            project_uuid: projectUuid.value,
            mission_uuid: row.uuid as string,
        },
    });
};

const missingTags = (row: MissionWithFilesDto): TagDto[] => {
    const mapped = project.value?.requiredTags.map((tagType) => {
        const setTypes = row.tags.map((tag) => tag.type);
        if (!setTypes.find((setType) => setType.uuid === tagType.uuid)) {
            return tagType;
        }
    });
    // @ts-ignore
    return mapped.filter((value) => !!value);
};

const missingTagsText = (row: MissionWithFilesDto): string => {
    const _missionTags = missingTags(row);
    if (_missionTags.length === 1) {
        return `1 Tag missing`;
    }
    return `${_missionTags.length.toString()} Tags missing`;
};

watch(
    () => selected.value,
    (newValue) => {
        $emit('update:selected', newValue);
    },
);
</script>
<style scoped></style>
