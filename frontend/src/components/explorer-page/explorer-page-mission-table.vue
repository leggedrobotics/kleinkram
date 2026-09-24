<template>
    <select-all-matching-banner
        noun="mission"
        :all-on-page-selected="allOnPageSelected"
        :all-matching-selected="allMatchingSelected"
        :page-count="data.length"
        :total="total"
        :busy="isSelectingAllMatching"
        @select-all="selectAllMatching"
        @clear="clearSelection"
    />

    <q-table
        ref="tableRef"
        v-model:pagination="pagination"
        v-model:selected="selected"
        flat
        :bordered="!isPhone"
        :grid="isPhone"
        :rows-per-page-options="[10, 20, 50, 100]"
        :rows="data"
        :columns="columnLayout.columns as any"
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
        <template #header-cell="props">
            <table-header-cell :cell-props="props" :layout="columnLayout" />
        </template>
        <template #header-cell-missionaction="props">
            <q-th :props="props">
                <table-column-settings :layout="columnLayout" />
            </q-th>
        </template>
        <template #body-cell="props">
            <q-td :props="props">
                <template v-if="props.col.metadataType">
                    <span v-if="props.value === ''" class="text-grey-5">
                        &ndash;
                    </span>
                    <a
                        v-else-if="
                            props.col.metadataType.datatype === DataType.LINK
                        "
                        :href="props.value"
                        target="_blank"
                        rel="noopener noreferrer"
                        @click.stop
                    >
                        {{ props.value }}
                    </a>
                    <template v-else>{{ props.value }}</template>
                </template>
                <template v-else>{{ props.value }}</template>
            </q-td>
        </template>
        <template #body-cell-name="props">
            <q-td :props="props">
                <router-link
                    :to="missionRoute(props.row)"
                    class="kk-row-link"
                    @click.stop
                >
                    {{ props.row.name }}
                </router-link>
            </q-td>
        </template>
        <template #body-cell-missingMetadata="props">
            <q-td :props="props" style="width: 150px">
                <div
                    v-if="missingMetadataTypes(props.row).length === 0"
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
                    {{ missingMetadataText(props.row) }}
                    <q-tooltip>
                        <div
                            v-for="metadataType in missingMetadataTypes(
                                props.row,
                            )"
                            :key="metadataType.uuid"
                            style="font-size: 14px"
                        >
                            {{ metadataType.name }}
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

                    <create-mission-dialog-opener
                        v-if="!isReadOnlyPublicView"
                        :project-uuid="projectUuid"
                    >
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
                                v-if="
                                    missingMetadataTypes(props.row).length === 0
                                "
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
                                {{ missingMetadataText(props.row) }}
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
                                        @click="() => openMission(props.row)"
                                    >
                                        <q-item-section>
                                            View Files
                                        </q-item-section>
                                    </q-item>
                                    <EditMissionDialogOpener
                                        v-if="!isReadOnlyPublicView"
                                        :mission="props.row"
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Edit Mission
                                            </q-item-section>
                                        </q-item>
                                    </EditMissionDialogOpener>
                                    <MissionMetadataOpener
                                        v-if="!isReadOnlyPublicView"
                                        :mission="props.row"
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Edit Metadata
                                            </q-item-section>
                                        </q-item>
                                    </MissionMetadataOpener>
                                    <MoveMissionDialogOpener
                                        v-if="!isReadOnlyPublicView"
                                        :mission="props.row"
                                    >
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                Move
                                            </q-item-section>
                                        </q-item>
                                    </MoveMissionDialogOpener>
                                    <DeleteMissionDialogOpener
                                        v-if="!isReadOnlyPublicView"
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
                                @click="() => openMission(props.row)"
                            >
                                <q-item-section>View Files</q-item-section>
                            </q-item>
                            <EditMissionDialogOpener
                                v-if="!isReadOnlyPublicView"
                                :mission="props.row"
                            >
                                <q-item v-ripple clickable>
                                    <q-item-section>
                                        Edit Mission
                                    </q-item-section>
                                </q-item>
                            </EditMissionDialogOpener>
                            <MissionMetadataOpener
                                v-if="!isReadOnlyPublicView"
                                :mission="props.row"
                            >
                                <q-item v-ripple clickable>
                                    <q-item-section>
                                        Edit Metadata
                                    </q-item-section>
                                </q-item>
                            </MissionMetadataOpener>
                            <MoveMissionDialogOpener
                                v-if="!isReadOnlyPublicView"
                                :mission="props.row"
                            >
                                <q-item v-ripple clickable>
                                    <q-item-section>Move</q-item-section>
                                </q-item>
                            </MoveMissionDialogOpener>
                            <DeleteMissionDialogOpener
                                v-if="!isReadOnlyPublicView"
                                :mission="props.row"
                            >
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
import type { MetadataTypeDto } from '@kleinkram/api-dto/types/metadata/metadata.dto';
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import type {
    FlatMissionDto,
    MissionsDto,
} from '@kleinkram/api-dto/types/mission/mission.dto';
import { DataType } from '@kleinkram/shared';
import { keepPreviousData, useQuery } from '@tanstack/vue-query';
import SelectAllMatchingBanner from 'components/common/select-all-matching-banner.vue';
import TableColumnSettings from 'components/common/table-columns/table-column-settings.vue';
import TableHeaderCell from 'components/common/table-columns/table-header-cell.vue';
import {
    missionColumns,
    missionMetadataColumn,
} from 'components/explorer-page/explorer-page-table-columns';
import { Notify, QTable, useQuasar } from 'quasar';
import { usePublicReadOnlyView } from 'src/composables/use-public-read-only-view';
import { useRowActivation } from 'src/composables/use-row-activation';
import { useTableColumns } from 'src/composables/use-table-columns';
import {
    useAllMetadataTypes,
    useHandler,
    useProjectQuery,
} from 'src/hooks/query-hooks';
import ROUTES from 'src/router/routes';
import { formatDate } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import { missionsOfProject } from 'src/services/queries/mission';
import { TableRequest } from 'src/services/query-handler';
import { computed, ref, watch } from 'vue';
import { RouteLocationRaw, useRouter } from 'vue-router';

import DeleteMissionDialogOpener from 'components/button-wrapper/delete-mission-dialog-opener.vue';
import CreateMissionDialogOpener from 'components/button-wrapper/dialog-opener-create-mission.vue';
import EditMissionDialogOpener from 'components/button-wrapper/edit-mission-dialog-opener.vue';
import MissionMetadataOpener from 'components/button-wrapper/mission-metadata-opener.vue';
import MoveMissionDialogOpener from 'components/button-wrapper/move-mission-dialog-pener.vue';
import { useProjectUUID } from 'src/hooks/router-hooks';

const queryHandler = useHandler();
const $q = useQuasar();

/**
 * Phones get a card list instead of a table, tablets keep the table but only
 * show the columns that fit without horizontal scrolling.
 */
const isPhone = computed(() => $q.screen.xs);
const isCompact = computed(() => $q.screen.lt.md);

const { data: metadataTypes } = useAllMetadataTypes();

const uniqueByName = (types: MetadataTypeDto[]): MetadataTypeDto[] => [
    ...new Map(types.map((type) => [type.name, type])).values(),
];

/**
 * Besides the fixed columns, every metadata type can be shown as a column of
 * its own. They are off by default and turned on in the column settings.
 */
const columnLayout = useTableColumns(
    'missions',
    () => [
        ...missionColumns,
        ...uniqueByName(metadataTypes.value ?? []).map((metadataType) =>
            missionMetadataColumn(metadataType),
        ),
    ],
    {
        compact: isCompact,
        compactColumns: [
            'name',
            'filesCount',
            'missingMetadata',
            'missionaction',
        ],
    },
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
const isReadOnlyPublicView = usePublicReadOnlyView(projectUuid);

/**
 * Two-way, so that the bulk-action bar in the parent and the checkboxes here
 * cannot drift apart: the bar clears the selection after a delete, and the
 * "select all matching" banner needs that clear to reach the table.
 */
const selected = defineModel<FlatMissionDto[]>('selected', {
    default: () => [],
});
const queryKey = computed(() => [
    'missions',
    projectUuid,
    queryHandler.value.queryKey,
]);

/**
 * One window onto the current result set, so that "select all matching" can
 * re-run the same filters over the full set.
 */
function fetchMissionsPage(take: number, skip: number): Promise<MissionsDto> {
    return missionsOfProject(
        projectUuid.value ?? '',
        take,
        skip,
        queryHandler.value.sortBy,
        queryHandler.value.descending,
        queryHandler.value.searchParams as { name: string },
    );
}

const {
    data: rawData,
    isLoading,
    refetch,
} = useQuery({
    queryKey: queryKey,
    queryFn: () =>
        fetchMissionsPage(queryHandler.value.take, queryHandler.value.skip),
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

/**
 * The backend caps `take` at 10 000 rows (PaginatedQueryDto), so a result set
 * larger than that cannot be selected in one request.
 */
const MAX_SELECT_ALL_MATCHING = 10_000;

/**
 * What decides which missions match, with the pagination left out: paging
 * through an all-matching selection must not invalidate it, changing the
 * search must.
 */
const filterKey = computed(() =>
    JSON.stringify({
        project: projectUuid.value,
        search: queryHandler.value.searchParams,
    }),
);

/** The filters that the last "select all matching" click ran against. */
const selectAllMatchingKey = ref<string>();
const isSelectingAllMatching = ref(false);

const allOnPageSelected = computed(() => {
    const selectedKeys = new Set(selected.value.map((row) => row.uuid));
    return (
        data.value.length > 0 &&
        data.value.every((row) => selectedKeys.has(row.uuid))
    );
});

/**
 * Only claim to cover the result set while the filters have not moved since
 * the click — otherwise a stale, larger selection would read as "all N
 * matching selected" against a smaller N.
 */
const allMatchingSelected = computed(
    () =>
        selectAllMatchingKey.value === filterKey.value &&
        total.value > 0 &&
        selected.value.length >= total.value,
);

async function selectAllMatching(): Promise<void> {
    if (total.value > MAX_SELECT_ALL_MATCHING) return;

    const requestedFor = filterKey.value;
    isSelectingAllMatching.value = true;
    try {
        const allMatching = await fetchMissionsPage(total.value, 0);

        // The filters may have moved while the request was in flight; dropping
        // the result is better than selecting rows nobody can see.
        if (filterKey.value !== requestedFor) return;

        selected.value = allMatching.data;
        selectAllMatchingKey.value = requestedFor;
    } catch (error_: unknown) {
        Notify.create({
            message: `Could not select all matching missions: ${
                error_ instanceof Error ? error_.message : 'unknown error'
            }`,
            color: 'negative',
            timeout: 2000,
            position: 'bottom',
        });
    } finally {
        isSelectingAllMatching.value = false;
    }
}

function clearSelection(): void {
    selected.value = [];
    selectAllMatchingKey.value = undefined;
}

const $router = useRouter();

/**
 * Route to a mission's files, shared by the row click and the name link.
 */
function missionRoute(row: FlatMissionDto): RouteLocationRaw {
    return {
        name: ROUTES.FILES.routeName,
        params: {
            projectUuid: projectUuid.value ?? '',
            missionUuid: row.uuid,
        },
    };
}

const openMission = async (row: FlatMissionDto): Promise<void> => {
    await $router.push(missionRoute(row));
};

/**
 * Navigates while nothing is selected, toggles the row once something is.
 * See use-row-activation for why that is safe here.
 */
const { onRowClick } = useRowActivation(selected, openMission);

const missingMetadataTypes = (row: MissionWithFilesDto): MetadataTypeDto[] => {
    const mapped = project.value?.requiredMetadataTypes.map((metadataType) => {
        const setTypes = row.metadata.map((metadata) => metadata.type);

        if (!setTypes.some((setType) => setType.uuid === metadataType.uuid)) {
            return metadataType;
        }
        return;
    });
    return mapped?.filter((value): value is MetadataTypeDto => !!value) ?? [];
};

const missingMetadataText = (row: MissionWithFilesDto): string => {
    const missing = missingMetadataTypes(row);
    if (missing.length === 1) {
        return `1 Metadata missing`;
    }
    return `${missing.length.toString()} Metadata missing`;
};
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
