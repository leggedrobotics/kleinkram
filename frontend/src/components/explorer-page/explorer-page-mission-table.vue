<template>
    <q-table
        ref="tableRef"
        v-model:pagination="pagination"
        v-model:selected="selected"
        flat
        :bordered="!isPhone"
        :grid="isPhone"
        :rows-per-page-options="[10, 20, 50, 100]"
        :rows="data"
        :columns="tableColumns as any"
        :visible-columns="visibleColumns"
        row-key="uuid"
        :loading="isLoading"
        binary-state-sort
        wrap-cells
        :virtual-scroll="!isPhone"
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

        <template #no-data>
            <div
                class="flex flex-center"
                style="justify-content: center; margin: auto"
            >
                <div
                    class="q-pa-md flex flex-center column q-gutter-md"
                    style="min-height: 200px"
                >
                    <span class="text-subtitle1"> No Mission Found </span>

                    <create-mission-dialog-opener :project-uuid="projectUuid">
                        <q-btn
                            flat
                            dense
                            padding="6px"
                            class="button-border"
                            label="Create Mission"
                            icon="sym_o_add"
                        />
                    </create-mission-dialog-opener>
                </div>
            </div>
        </template>

        <!-- Phone layout: one tappable card per mission -->
        <template #item="props">
            <div class="col-12 q-pb-sm">
                <q-card
                    flat
                    bordered
                    class="mission-card"
                    :class="{ 'mission-card--selected': props.selected }"
                >
                    <div class="row no-wrap items-start q-pa-sm">
                        <q-checkbox
                            v-model="props.selected"
                            dense
                            color="grey-8"
                            class="q-mr-sm"
                            aria-label="Select mission"
                        />

                        <div
                            class="col cursor-pointer"
                            style="min-width: 0"
                            @click="(event) => onRowClick(event, props.row)"
                        >
                            <div
                                class="text-subtitle2 mission-card__text ellipsis-2-lines"
                            >
                                {{ props.row.name }}
                            </div>
                            <div class="text-caption text-grey-7 q-mt-xs">
                                {{ props.row.filesCount }}
                                {{
                                    props.row.filesCount === 1
                                        ? 'file'
                                        : 'files'
                                }}
                                &middot; {{ formatSize(props.row.size) }}
                            </div>
                            <div class="text-caption text-grey-7">
                                {{ props.row.creator.name }} &middot;
                                {{ formatDate(new Date(props.row.createdAt)) }}
                            </div>
                            <div
                                v-if="missingTags(props.row).length === 0"
                                class="text-caption q-mt-xs"
                            >
                                <q-icon
                                    name="sym_o_check"
                                    color="black"
                                    size="14px"
                                    class="q-mr-xs"
                                />
                                Metadata complete
                            </div>
                            <div
                                v-else
                                class="text-caption q-mt-xs"
                                style="color: red"
                            >
                                <q-icon
                                    name="sym_o_error"
                                    color="red"
                                    size="16px"
                                    class="q-mr-xs"
                                />
                                {{ missingTagsText(props.row) }}
                            </div>
                        </div>

                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_more_vert"
                            unelevated
                            color="primary"
                            class="cursor-pointer"
                            aria-label="Mission actions"
                            @click.stop
                        >
                            <q-menu auto-close>
                                <q-list>
                                    <q-item
                                        v-ripple
                                        clickable
                                        @click="
                                            (event) =>
                                                onRowClick(event, props.row)
                                        "
                                    >
                                        <q-item-section>
                                            View Files
                                        </q-item-section>
                                    </q-item>
                                    <EditMissionDialogOpener
                                        :mission="props.row"
                                    >
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
                                    <MoveMissionDialogOpener
                                        :mission="props.row"
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Move
                                            </q-item-section>
                                        </q-item>
                                    </MoveMissionDialogOpener>
                                    <DeleteMissionDialogOpener
                                        :mission="props.row"
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Delete
                                            </q-item-section>
                                        </q-item>
                                    </DeleteMissionDialogOpener>
                                </q-list>
                            </q-menu>
                        </q-btn>
                    </div>
                </q-card>
            </div>
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
                    aria-label="Mission actions"
                    @click.stop
                >
                    <q-menu auto-close>
                        <q-list>
                            <q-item
                                v-ripple
                                clickable
                                @click="(event) => onRowClick(event, props.row)"
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
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import type { TagDto } from '@kleinkram/api-dto/types/tags/tags.dto';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import { missionColumns } from 'components/explorer-page/explorer-page-table-columns';
import { QTable, useQuasar } from 'quasar';
import { useHandler, useProjectQuery } from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { formatDate } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import { missionsOfProject } from 'src/services/queries/mission';
import { TableRequest } from 'src/services/query-handler';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import DeleteMissionDialogOpener from 'components/button-wrapper/delete-mission-dialog-opener.vue';
import CreateMissionDialogOpener from 'components/button-wrapper/dialog-opener-create-mission.vue';
import EditMissionDialogOpener from 'components/button-wrapper/edit-mission-dialog-opener.vue';
import MissionMetadataOpener from 'components/button-wrapper/mission-metadata-opener.vue';
import MoveMissionDialogOpener from 'components/button-wrapper/move-mission-dialog-pener.vue';
import { useProjectUUID } from 'src/hooks/router-hooks';

const $emit = defineEmits(['update:selected']);

const queryHandler = useHandler();
const $q = useQuasar();

/**
 * Phones get a card list instead of a table, tablets keep the table but only
 * show the columns that fit without horizontal scrolling.
 */
const isPhone = computed(() => $q.screen.xs);
const isCompact = computed(() => $q.screen.lt.md);

const tableColumns = computed(() =>
    isCompact.value
        ? // `required` columns cannot be hidden by `visible-columns`
          missionColumns.map((column) => ({ ...column, required: false }))
        : missionColumns,
);

const visibleColumns = computed(() =>
    isCompact.value
        ? ['name', 'NrOfFiles', 'tagverification', 'missionaction']
        : undefined,
);

async function setPagination(update: TableRequest): Promise<void> {
    queryHandler.value.setPage(update.pagination.page);
    queryHandler.value.setTake(update.pagination.rowsPerPage);
    queryHandler.value.setSort(update.pagination.sortBy);
    queryHandler.value.setDescending(update.pagination.descending);
    await refetch();
}

const pagination = computed({
    get: () => ({
        page: queryHandler.value.page,
        rowsPerPage: queryHandler.value.take,
        rowsNumber: queryHandler.value.rowsNumber,
        sortBy: queryHandler.value.sortBy,
        descending: queryHandler.value.descending,
    }),
    set: (value) => ({
        page: value.page,
        rowsPerPage: value.rowsPerPage,
        sortBy: value.sortBy,
        descending: value.descending,
    }),
});

const projectUuid = useProjectUUID();
const { data: project } = useProjectQuery(projectUuid);

const selected = ref([]);
const queryKey = computed(() => [
    'missions',
    projectUuid,
    queryHandler.value.queryKey,
]);

const {
    data: rawData,
    isLoading,
    refetch,
} = useQuery({
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
    placeholderData: keepPreviousData,
});

const data = computed(() => (rawData.value ? rawData.value.data : []));
const total = computed(() => (rawData.value ? rawData.value.count : 0));

watch(
    () => total.value,
    () => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (data.value && !isLoading.value) {
            queryHandler.value.rowsNumber = total.value;
        }
    },
    { immediate: true },
);
const $router = useRouter();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onRowClick = async (_: Event, row: any) => {
    await $router.push({
        name: ROUTES.FILES.routeName,
        params: {
            projectUuid: projectUuid.value,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            missionUuid: row.uuid as string,
        },
    });
};

const missingTags = (row: MissionWithFilesDto): TagDto[] => {
    const mapped = project.value?.requiredTags.map((tagType) => {
        const setTypes = row.tags.map((tag) => tag.type);

        if (!setTypes.some((setType) => setType.uuid === tagType.uuid)) {
            return tagType;
        }
        return;
    });
    return mapped?.filter((value): value is TagDto => !!value) ?? [];
};

const missingTagsText = (row: MissionWithFilesDto): string => {
    const _missionTags = missingTags(row);
    if (_missionTags.length === 1) {
        return `1 Metadata missing`;
    }
    return `${_missionTags.length.toString()} Metadata missing`;
};

watch(
    () => selected.value,
    (newValue) => {
        $emit('update:selected', newValue);
    },
);
</script>
<style scoped>
.mission-card {
    border-radius: 4px;
}

.mission-card--selected {
    background-color: #e7efff;
}

.mission-card__text {
    overflow-wrap: anywhere;
}
</style>
