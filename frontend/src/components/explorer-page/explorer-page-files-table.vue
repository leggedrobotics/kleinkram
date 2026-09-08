<template>
    <div v-if="isPhone" class="row items-center justify-between q-mb-sm">
        <q-btn-dropdown
            flat
            dense
            no-caps
            class="text-grey-8"
            icon="sym_o_swap_vert"
            :label="`Sort: ${activeSortLabel}`"
            aria-label="Change sorting"
        >
            <q-list>
                <q-item
                    v-for="option in sortOptions"
                    :key="option.value"
                    v-close-popup
                    clickable
                    @click="() => toggleSort(option.value)"
                >
                    <q-item-section>{{ option.label }}</q-item-section>
                    <q-item-section side>
                        <q-icon
                            v-if="pagination.sortBy === option.value"
                            :name="
                                pagination.descending
                                    ? 'sym_o_arrow_downward'
                                    : 'sym_o_arrow_upward'
                            "
                            size="18px"
                        />
                    </q-item-section>
                </q-item>
            </q-list>
        </q-btn-dropdown>

        <q-btn
            flat
            dense
            no-caps
            class="text-grey-8"
            :icon="allOnPageSelected ? 'sym_o_deselect' : 'sym_o_select_all'"
            :label="allOnPageSelected ? 'Clear' : 'Select all'"
            :aria-label="
                allOnPageSelected
                    ? 'Clear selection'
                    : 'Select all files on this page'
            "
            @click="toggleSelectAll"
        />
    </div>

    <q-table
        ref="tableRef"
        v-model:pagination="pagination"
        v-model:selected="selected"
        flat
        bordered
        :rows-per-page-options="[5, 10, 20, 50, 100]"
        :rows="data"
        :columns="visibleFileColumns as any"
        row-key="uuid"
        :loading="isLoading"
        binary-state-sort
        wrap-cells
        :grid="isPhone"
        :virtual-scroll="!isPhone"
        separator="none"
        selection="multiple"
        :class="{ 'files-table--grid': isPhone }"
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

        <template #no-data>
            <div class="full-width flex flex-center q-pa-xl text-grey">
                <div v-if="isMissionEmpty" class="column items-center">
                    <q-icon name="sym_o_folder_open" size="3rem" />
                    <span class="q-mt-sm text-subtitle1">
                        No files uploaded yet
                    </span>
                    <div class="q-mt-md">
                        <CreateFileDialogOpener
                            v-if="missionData !== undefined"
                            :mission="missionData"
                        >
                            <q-btn
                                flat
                                dense
                                padding="6px"
                                class="button-border text-black"
                                label="Upload File"
                                icon="sym_o_upload"
                                no-caps
                            />
                        </CreateFileDialogOpener>
                    </div>
                </div>

                <div v-else-if="hasActiveFilters" class="column items-center">
                    <q-icon name="sym_o_search_off" size="3rem" />
                    <span class="q-mt-sm text-subtitle1">
                        No files found matching your filters
                    </span>
                    <q-btn
                        flat
                        dense
                        no-caps
                        padding="6px"
                        label="Reset Filters"
                        class="button-border text-black q-mt-md"
                        icon="sym_o_clear"
                        @click="resetFilters"
                    />
                </div>

                <div v-else class="column items-center">
                    <span class="text-subtitle1">No data available</span>
                </div>
            </div>
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

        <template #item="props">
            <div class="col-12 file-card-wrapper">
                <q-card
                    flat
                    bordered
                    class="file-card"
                    :class="{ 'file-card--selected': props.selected }"
                    @click="() => openFile(props.row)"
                >
                    <div class="q-pa-sm">
                        <div class="row items-center no-wrap">
                            <q-checkbox
                                v-model="props.selected"
                                dense
                                color="grey-8"
                                class="q-mr-sm"
                                :aria-label="`Select ${props.row.filename}`"
                                @click.stop
                            />
                            <q-icon
                                :name="getIcon(props.row.state)"
                                :color="getColorFileState(props.row.state)"
                                size="20px"
                                class="q-mr-sm"
                            >
                                <q-tooltip>
                                    {{ getTooltip(props.row.state) }}
                                </q-tooltip>
                            </q-icon>
                            <div class="col file-card__name">
                                {{ props.row.filename }}
                            </div>
                            <q-btn
                                flat
                                round
                                dense
                                icon="sym_o_more_vert"
                                unelevated
                                color="primary"
                                class="cursor-pointer"
                                aria-label="File actions"
                                @click.stop
                            >
                                <q-menu auto-close>
                                    <q-list>
                                        <q-item
                                            v-ripple
                                            clickable
                                            @click="() => openFile(props.row)"
                                        >
                                            <q-item-section>
                                                View
                                            </q-item-section>
                                        </q-item>
                                        <q-item v-ripple clickable>
                                            <q-item-section>
                                                <edit-file-dialog-opener
                                                    :file="props.row"
                                                >
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
                                            <q-item-section>
                                                Download
                                            </q-item-section>
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
                                                    :file="props.row"
                                                >
                                                    Delete File
                                                </DeleteFileDialogOpener>
                                            </q-item-section>
                                        </q-item>
                                    </q-list>
                                </q-menu>
                            </q-btn>
                        </div>

                        <div
                            class="row items-center text-caption text-grey-7 file-card__meta"
                        >
                            <span>{{ formatSize(props.row.size) }}</span>
                            <span aria-hidden="true">&middot;</span>
                            <span>
                                {{ formatDate(new Date(props.row.date)) }}
                            </span>
                        </div>

                        <div
                            v-if="sortedCats(props.row).length > 0"
                            class="q-mt-xs"
                        >
                            <q-chip
                                v-for="cat in sortedCats(props.row)"
                                :key="cat.uuid"
                                :label="cat.name"
                                :color="hashUUIDtoColor(cat.uuid)"
                                style="color: white"
                                dense
                                clickable
                                class="q-mr-xs q-ml-none"
                                @click.stop="() => chipClicked(cat)"
                            />
                        </div>
                    </div>
                </q-card>
            </div>
        </template>
    </q-table>

    <div class="flex row justify-center q-mt-sm">
        <RouterLink
            :to="nextMissionUuid === '' ? '' : `../${nextMissionUuid}/files`"
        >
            <q-btn
                round
                :disable="nextMissionUuid === ''"
                flat
                color="grey-6"
                icon="sym_o_keyboard_double_arrow_left"
            >
                <q-tooltip> Previous Mission</q-tooltip>
            </q-btn>
        </RouterLink>

        <span class="flex column justify-center text-grey-8">
            navigate between missions
        </span>

        <RouterLink
            :to="
                previousMissionUuid === ''
                    ? ''
                    : `../${previousMissionUuid}/files`
            "
        >
            <q-btn
                round
                :disable="previousMissionUuid === ''"
                flat
                color="grey-6"
                icon="sym_o_keyboard_double_arrow_right"
            >
                <q-tooltip> Next Mission</q-tooltip>
            </q-btn>
        </RouterLink>
    </div>
</template>

<script setup lang="ts">
import type { CategoryDto } from '@kleinkram/api-dto/types/category.dto';
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type { FilesDto } from '@kleinkram/api-dto/types/file/files.dto';
import { FileState, FileType, HealthStatus } from '@kleinkram/shared';
import {
    keepPreviousData,
    useQuery,
    UseQueryReturnType,
} from '@tanstack/vue-query';
import DeleteFileDialogOpener from 'components/button-wrapper/delete-file-dialog-opener.vue';
import CreateFileDialogOpener from 'components/button-wrapper/dialog-opener-create-file.vue';
import EditFileDialogOpener from 'components/button-wrapper/edit-file-dialog-opener.vue';
import MoveFileDialogOpener from 'components/button-wrapper/move-file-dialog-opener.vue';
import { fileColumns } from 'components/explorer-page/explorer-page-table-columns';
import { QTable, useQuasar } from 'quasar';
import {
    useHandler,
    useMission,
    useMissionsOfProjectMinimal,
} from 'src/hooks/query-hooks';
import { useMissionUUID, useProjectUUID } from 'src/hooks/router-hooks';
import ROUTES from 'src/router/routes';
import { formatDate, parseDate } from 'src/services/date-formating';
import { formatSize } from 'src/services/general-formatting';
import {
    _downloadFile,
    getColorFileState,
    getIcon,
    getTooltip,
    hashUUIDtoColor,
} from 'src/services/generic';
import { filesOfMission } from 'src/services/queries/file';
import { TableRequest } from 'src/services/query-handler';
import { computed, unref, watch } from 'vue';
import { useRouter } from 'vue-router';

const selected = defineModel('selected', { required: true, type: Array });

const $emit = defineEmits(['update:selected', 'reset-filter']);
const $router = useRouter();
const $q = useQuasar();

/**
 * Phones render the files as tappable cards, tablets keep the table but drop
 * the secondary columns so that it fits without horizontal scrolling.
 */
const isPhone = computed(() => $q.screen.xs);

const COMPACT_COLUMN_NAMES = new Set([
    'state',
    'filename',
    'size',
    'fileaction',
]);

const visibleFileColumns = computed(() =>
    $q.screen.lt.md
        ? fileColumns.filter((column) => COMPACT_COLUMN_NAMES.has(column.name))
        : fileColumns,
);

const sortOptions = [
    { label: 'File name', value: 'filename' },
    { label: 'Health', value: 'state' },
    { label: 'Created', value: 'createdAt' },
    { label: 'Size', value: 'size' },
];

const projectUuid = useProjectUUID();
const missionUuid = useMissionUUID();
const { data: missionData } = useMission(missionUuid);

const isMissionEmpty = computed(() => {
    return missionData.value?.files.length === 0;
});

const hasActiveFilters = computed(() => {
    const h = queryHandler.value;

    const totalFileTypes = Object.values(FileType).filter(
        (t) => t !== FileType.ALL,
    ).length;

    const isTypeFilterActive =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        h.fileTypes && h.fileTypes.length < totalFileTypes;

    return (
        ((h.searchParams.name && h.searchParams.name.length > 0) ??
            (h.searchParams.health && h.searchParams.health.length > 0) ??
            (h.searchParams.startDate && h.searchParams.startDate.length > 0) ??
            (h.searchParams.endDate && h.searchParams.endDate.length > 0) ??
            (h.searchParams.topics && h.searchParams.topics.length > 0) ??
            (h.searchParams.messageDatatypes &&
                h.searchParams.messageDatatypes.length > 0) ??
            isTypeFilterActive) ||
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        (h.categories && h.categories.length > 0)
    );
});

function resetFilters(): void {
    $emit('reset-filter');
}

const { data: missions } = useMissionsOfProjectMinimal(projectUuid, 100, 0);

const nextMissionUuid = computed(() => {
    const indexOfMission = unref(missions)?.data.findIndex(
        (mission) => mission.uuid === missionUuid.value,
    );
    if (indexOfMission === undefined || indexOfMission === -1) {
        return '';
    }
    const nextMission = unref(missions)?.data[indexOfMission + 1];
    return nextMission ? nextMission.uuid : '';
});

const previousMissionUuid = computed(() => {
    const indexOfMission = unref(missions)?.data.findIndex(
        (mission) => mission.uuid === missionUuid.value,
    );
    if (indexOfMission === undefined || indexOfMission === -1) {
        return '';
    }
    const previousMission = unref(missions)?.data[indexOfMission - 1];
    return previousMission ? previousMission.uuid : '';
});

const queryHandler = useHandler();

if (queryHandler.value.sortBy === 'name') {
    queryHandler.value.setSort('filename');
}

async function setPagination(update: TableRequest): Promise<void> {
    queryHandler.value.setPage(update.pagination.page);
    queryHandler.value.setTake(update.pagination.rowsPerPage);
    queryHandler.value.setSort(update.pagination.sortBy);
    queryHandler.value.setDescending(update.pagination.descending);
    await refetch();
}

const activeSortLabel = computed(
    () =>
        sortOptions.find((option) => option.value === queryHandler.value.sortBy)
            ?.label ?? 'File name',
);

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

const queryKey = computed(() => [
    'files',
    missionUuid.value,
    queryHandler.value.queryKey,
]);
const {
    data: rawData,
    isLoading,
    refetch,
}: UseQueryReturnType<FilesDto | undefined, Error> = useQuery({
    queryKey: queryKey,
    queryFn: () => {
        const h = queryHandler.value;
        return filesOfMission(
            missionUuid.value ?? '',
            h.take,
            h.skip,
            h.fileTypes,
            h.searchParams.name,
            h.categories,
            h.sortBy,
            h.descending,

            h.searchParams.health as HealthStatus,
            h.searchParams.startDate
                ? parseDate(h.searchParams.startDate)
                : undefined,
            h.searchParams.endDate
                ? parseDate(h.searchParams.endDate)
                : undefined,
            // Topics and Datatypes
            h.searchParams.topics && h.searchParams.topics.length > 0
                ? h.searchParams.topics.split(',')
                : undefined,
            h.searchParams.messageDatatypes &&
                h.searchParams.messageDatatypes.length > 0
                ? h.searchParams.messageDatatypes.split(',')
                : undefined,
            h.searchParams.matchAllTopics === 'true',
            undefined,
            [FileState.CANCELED],
        );
    },
    placeholderData: keepPreviousData,
});
const data = computed(() => (rawData.value ? rawData.value.data : []));
const total = computed(() => (rawData.value ? rawData.value.count : 0));

/**
 * The card layout has no header row, so selecting every file of the current
 * page gets its own button.
 */
const allOnPageSelected = computed(() => {
    const selectedKeys = new Set(
        selected.value.map((row) => (row as FileWithTopicDto).uuid),
    );
    return (
        data.value.length > 0 &&
        data.value.every((row) => selectedKeys.has(row.uuid))
    );
});

function toggleSelectAll(): void {
    const pageKeys = new Set(data.value.map((row) => row.uuid));
    const otherPages = selected.value.filter(
        (row) => !pageKeys.has((row as FileWithTopicDto).uuid),
    );
    selected.value = allOnPageSelected.value
        ? otherPages
        : [...otherPages, ...data.value];
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const openFile = async (row: any): Promise<void> => {
    await $router.push({
        path: '',
        // @ts-ignore
        name: ROUTES.FILE.routeName,
        params: {
            projectUuid: projectUuid.value,
            missionUuid: missionUuid.value,

            // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            file_uuid: row.uuid,
        },
    });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onRowClick = async (_: Event, row: any): Promise<void> => {
    await openFile(row);
};

/**
 * Sorting control used by the card layout on phones, where the sortable
 * table header is not rendered.
 */
async function toggleSort(name: string): Promise<void> {
    const handler = queryHandler.value;
    handler.setDescending(
        handler.sortBy === name ? !handler.descending : false,
    );
    handler.setSort(name);
    handler.setPage(1);
    await refetch();
}

function chipClicked(cat: CategoryDto): void {
    queryHandler.value.addCategory(cat.uuid);
}

watch(
    () => selected.value,
    (newValue) => {
        $emit('update:selected', newValue);
    },
);

function sortedCats(file: FileWithTopicDto): CategoryDto[] {
    return file.categories.toSorted((a, b) => a.name.localeCompare(b.name));
}
</script>

<style scoped>
.file-card-wrapper {
    padding: 4px 0;
}

.file-card {
    border-radius: 4px;
}

.file-card--selected {
    background-color: #e7efff;
}

.file-card__name {
    min-width: 0;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    overflow: hidden;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.file-card__meta {
    gap: 6px;
    margin-top: 2px;
}

/* The card list is a plain column; the cards carry their own borders, so the
   table container does not need one. */
.files-table--grid {
    border: 0;
    background: transparent;
}

.files-table--grid :deep(.q-table__grid-content) {
    margin: 0;
}

@media (max-width: 599px) {
    /* .q-table__bottom already wraps globally; keep it compact and give the
       pagination arrows a comfortable touch target. */
    :deep(.q-table__bottom) {
        font-size: 12px;
        column-gap: 8px;
    }

    :deep(.q-table__bottom .q-btn) {
        min-height: 36px;
        min-width: 36px;
    }
}
</style>
