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
import { FileType, HealthStatus } from '@kleinkram/shared';
import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
import DeleteFileDialogOpener from 'components/button-wrapper/delete-file-dialog-opener.vue';
import CreateFileDialogOpener from 'components/button-wrapper/dialog-opener-create-file.vue';
import EditFileDialogOpener from 'components/button-wrapper/edit-file-dialog-opener.vue';
import MoveFileDialogOpener from 'components/button-wrapper/move-file-dialog-opener.vue';
import { fileColumns } from 'components/explorer-page/explorer-page-table-columns';
import { QTable } from 'quasar';
import { useMission, useMissionsOfProjectMinimal } from 'src/hooks/query-hooks';
import { useMissionUUID, useProjectUUID } from 'src/hooks/router-hooks';
import ROUTES from 'src/router/routes';
import {
    _downloadFile,
    getColorFileState,
    getIcon,
    getTooltip,
    hashUUIDtoColor,
} from 'src/services/generic';
import { filesOfMission } from 'src/services/queries/file';
import { QueryHandler, TableRequest } from 'src/services/query-handler';
import { computed, unref, watch } from 'vue';
import { useRouter } from 'vue-router';

const selected = defineModel('selected', { required: true, type: Array });

const $emit = defineEmits(['update:selected', 'reset-filter']);
const $router = useRouter();

const projectUuid = useProjectUUID();
const missionUuid = useMissionUUID();
const { data: missionData } = useMission(missionUuid);

const isMissionEmpty = computed(() => {
    return missionData.value && missionData.value.files?.length === 0;
});

const hasActiveFilters = computed(() => {
    const h = properties.urlHandler;

    const totalFileTypes = Object.values(FileType).filter(
        (t) => t !== FileType.ALL,
    ).length;

    const isTypeFilterActive =
        h.fileTypes && h.fileTypes.length < totalFileTypes;

    return (
        (h.searchParams.name && h.searchParams.name.length > 0) ||
        (h.searchParams.health && h.searchParams.health.length > 0) ||
        isTypeFilterActive ||
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

const properties = defineProps<{
    urlHandler: QueryHandler;
}>();

if (properties.urlHandler.sortBy === 'name') {
    properties.urlHandler.setSort('filename');
}

function setPagination(update: TableRequest): void {
    properties.urlHandler.setPage(update.pagination.page);
    properties.urlHandler.setTake(update.pagination.rowsPerPage);
    properties.urlHandler.setSort(update.pagination.sortBy);
    properties.urlHandler.setDescending(update.pagination.descending);
}

const pagination = computed(() => {
    return {
        page: properties.urlHandler.page,
        rowsPerPage: properties.urlHandler.take,
        rowsNumber: properties.urlHandler.rowsNumber,
        sortBy: properties.urlHandler.sortBy,
        descending: properties.urlHandler.descending,
    };
});

const queryKey = computed(() => [
    'files',
    missionUuid.value,
    properties.urlHandler.queryKey,
    properties.urlHandler.fileTypes,
    properties.urlHandler.categories,
]);
const {
    data: rawData,
    isLoading,
}: UseQueryReturnType<FilesDto | undefined, Error> = useQuery({
    queryKey: queryKey,
    queryFn: () =>
        filesOfMission(
            missionUuid.value ?? '',
            properties.urlHandler.take,
            properties.urlHandler.skip,
            properties.urlHandler.fileTypes,
            properties.urlHandler.searchParams.name,
            properties.urlHandler.categories,
            properties.urlHandler.sortBy,
            properties.urlHandler.descending,
            properties.urlHandler.searchParams.health as HealthStatus,
        ),
});
const data = computed(() => (rawData.value ? rawData.value.data : []));
const total = computed(() => (rawData.value ? rawData.value.count : 0));

watch(
    () => total.value,
    () => {
        if (data.value && !isLoading.value) {
            // eslint-disable-next-line vue/no-mutating-props
            properties.urlHandler.rowsNumber = total.value;
        }
    },
    { immediate: true },
);

const onRowClick = async (_: Event, row: any): Promise<void> => {
    await $router.push({
        path: '',
        // @ts-ignore
        name: ROUTES.FILE.routeName,
        params: {
            projectUuid: projectUuid.value,
            missionUuid: missionUuid.value,
            file_uuid: row.uuid,
        },
    });
};

function chipClicked(cat: CategoryDto): void {
    properties.urlHandler.addCategory(cat.uuid);
}

watch(
    () => selected.value,
    (newValue) => {
        $emit('update:selected', newValue);
    },
);

function sortedCats(file: FileWithTopicDto): CategoryDto[] {
    return file.categories.sort((a, b) => a.name.localeCompare(b.name));
}
</script>
