<template>
    <div class="row items-center">
        <div class="col-5 q-py-md q-pr-md">
            <q-input v-model="startDate" filled hint="File Processing since: ">
                <template #prepend>
                    <q-icon name="sym_o_event" class="cursor-pointer">
                        <q-popup-proxy
                            cover
                            transition-show="scale"
                            transition-hide="scale"
                        >
                            <q-date v-model="startDate" :mask="dateMask">
                                <div class="row items-center justify-end">
                                    <q-btn
                                        v-close-popup
                                        label="Close"
                                        color="primary"
                                        flat
                                    />
                                </div>
                            </q-date>
                        </q-popup-proxy>
                    </q-icon>
                </template>

                <template #append>
                    <q-icon name="sym_o_access_time" class="cursor-pointer">
                        <q-popup-proxy
                            cover
                            transition-show="scale"
                            transition-hide="scale"
                        >
                            <q-time
                                v-model="startDate"
                                :mask="dateMask"
                                format24h
                            >
                                <div class="row items-center justify-end">
                                    <q-btn
                                        v-close-popup
                                        label="Close"
                                        color="primary"
                                        flat
                                    />
                                </div>
                            </q-time>
                        </q-popup-proxy>
                    </q-icon>
                </template>
            </q-input>
        </div>
        <div class="col-5 q-py-md q-pr-md">
            <q-select
                v-model="fileStateFilter"
                multiple
                clearable
                :options="FileStateOptions"
                label="Select filter"
            >
                <template #selected-item="scope">
                    <q-chip
                        removable
                        :tabindex="scope.tabindex"
                        dense
                        :color="
                            getColor(
                                QueueState[scope.opt] as unknown as QueueState,
                            ) as any
                        "
                        @remove="() => removeItem(scope.opt)"
                    >
                        {{ scope.opt }}
                    </q-chip>
                </template>
                <template #no-option>
                    <q-item>
                        <q-item-section class="text-grey">
                            No results
                        </q-item-section>
                    </q-item>
                </template>
                <template #append>
                    <q-icon
                        class="cursor-pointer"
                        @click.stop="clearSelection"
                    />
                </template>
            </q-select>
        </div>
        <div class="col-2 q-py-md">
            <q-btn
                flat
                dense
                padding="6px"
                color="icon-secondary"
                class="button-border"
                icon="sym_o_loop"
                @click="refresh"
            >
                <q-tooltip> Refresh Data </q-tooltip>
            </q-btn>
        </div>
    </div>

    <q-table
        ref="tableReference"
        v-model:pagination="pagination"
        v-model:selected="selected"
        :rows="queueEntries || []"
        :columns="columns as any"
        row-key="uuid"
        flat
        bordered
        :loading="isLoading"
        binary-state-sort
        selection="multiple"
        @row-click="rowClick"
    >
        <template #body-selection="props">
            <q-checkbox
                v-model="props.selected"
                color="grey-8"
                class="checkbox-with-hitbox"
            />
        </template>
        <template #body-cell-Status="props">
            <q-td :props="props">
                <q-badge :color="getColor(props.row.state)">
                    <q-tooltip>
                        {{ getDetailedFileState(props.row.state) }}
                    </q-tooltip>
                    {{ getSimpleFileStateName(props.row.state) }}
                </q-badge>
            </q-td>
        </template>
        <template #body-cell-action="props">
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
                    <q-menu
                        auto-close
                        style="max-width: 150px; min-width: 140px; width: 145px"
                    >
                        <q-list>
                            <q-item
                                v-ripple
                                clickable
                                :disable="
                                    props.row.state !== QueueState.COMPLETED
                                "
                                @click="() => downloadFile(props.row)"
                            >
                                <q-item-section>Download File</q-item-section>
                            </q-item>
                            <q-item
                                v-ripple
                                clickable
                                :disable="!canDelete(props.row)"
                                @click="() => openDeleteFileDialog(props.row)"
                            >
                                <q-item-section>Delete File</q-item-section>
                            </q-item>
                            <q-item
                                v-ripple
                                clickable
                                :disable="
                                    props.row.state !==
                                    QueueState.AWAITING_PROCESSING
                                "
                                @click="() => _cancelProcessing(props.row)"
                            >
                                <q-item-section>
                                    Cancel Processing
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
import { FileQueueEntryDto } from '@api/types/file/file-queue-entry.dto';
import { FileLocation, QueueState } from '@common/enum';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { Notify, QTable, useQuasar } from 'quasar';
import ConfirmDeleteFile from 'src/dialogs/confirm-delete-file-dialog.vue';
import ROUTES from 'src/router/routes';
import { dateMask, formatDate, parseDate } from 'src/services/date-formating';
import {
    _downloadFile,
    getColor,
    getDetailedFileState,
    getSimpleFileStateName,
} from 'src/services/generic';
import { cancelProcessing, deleteFile } from 'src/services/mutations/queue';
import { findOneByNameAndMission } from 'src/services/queries/file';
import { currentQueue } from 'src/services/queries/queue';
import { computed, ref, Ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { FileWithTopicDto } from '@api/types/file/file.dto';
import { ProjectWithMissionsDto } from '@api/types/project/project-with-missions.dto';

const $router = useRouter();
const queryClient = useQueryClient();
const $q = useQuasar();

const tableReference: Ref<QTable | undefined> = ref(undefined);
const now = new Date();
const startDate = ref(formatDate(new Date(now.getTime() - 1000 * 60 * 30)));
const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 10,
});

const queueKey = computed(() => [
    'queue',
    startDate.value,
    fileStateFilterEnums.value,
]);
const selected = ref<FileQueueEntryDto[]>([]);

const fileStateFilter = ref<string[]>([]);

const FileStateOptions = Object.keys(QueueState).splice(
    Object.keys(QueueState).length / 2,
); //  WHY JAVASCRIPT, WHY?

const removeItem = (value: string): void => {
    fileStateFilter.value = fileStateFilter.value.filter(
        (item) => item !== value,
    );
};

const clearSelection = (): void => {
    fileStateFilter.value = fileStateFilter.value.slice(0, 0);
};

watch(fileStateFilter, () => {
    if (fileStateFilter.value) {
        fileStateFilter.value = fileStateFilter.value.sort((a, b) =>
            // @ts-ignore
            QueueState[a] > QueueState[b] ? 1 : -1,
        );
    }
});

const fileStateFilterEnums = computed(() => {
    if (!fileStateFilter.value) return [];
    // @ts-ignore
    return fileStateFilter.value.map((state) => QueueState[state]);
});

const { data: queueEntries, isLoading } = useQuery<ProjectWithMissionsDto[]>({
    queryKey: queueKey,
    queryFn: () =>
        currentQueue(parseDate(startDate.value), fileStateFilterEnums.value),
    refetchInterval: 1000,
});

const { mutate: removeFile } = useMutation({
    mutationFn: (queueEntry: FileQueueEntryDto) =>
        deleteFile(queueEntry.mission.uuid, queueEntry.uuid),
    onSuccess: async () => {
        Notify.create({
            message: 'File deleted',
            color: 'positive',
            timeout: 2000,
            position: 'bottom',
        });
        await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'queue',
        });
    },
    onError: (error: unknown) => {
        Notify.create({
            message: `Error deleting file: ${
                (
                    error as {
                        response?: { data?: { message?: string } };
                    }
                ).response?.data?.message ??
                (error as { message: string }).message
            }`,
            color: 'negative',
            timeout: 4000,
            position: 'bottom',
        });
    },
});

const { mutate: _cancelProcessing } = useMutation({
    mutationFn: (queueEntry: FileQueueEntryDto) =>
        cancelProcessing(queueEntry.uuid, queueEntry.mission.uuid),
    onSuccess: async () => {
        await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'queue',
        });
    },
    onError: (error: unknown) => {
        Notify.create({
            message: `Error canceling processing: ${
                (
                    error as {
                        response?: { data?: { message?: string } };
                    }
                ).response?.data?.message ??
                (error as { message?: string }).message ??
                ''
            }`,
            color: 'negative',
            timeout: 4000,
            position: 'bottom',
        });
    },
});

const openDeleteFileDialog = (queueEntry: FileQueueEntryDto): void => {
    $q.dialog({
        component: ConfirmDeleteFile,
        componentProps: {
            filename: queueEntry.display_name,
        },
    }).onOk(() => {
        removeFile(queueEntry);
    });
};

// Refresh function to invalidate the query
async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'queue',
    });
}

async function rowClick(event: any, row: FileQueueEntryDto): Promise<void> {
    const isFile =
        row.display_name.endsWith('.bag') || row.display_name.endsWith('.mcap');
    const isCompleted = row.state === QueueState.COMPLETED;
    if (isFile && isCompleted) {
        await findOneByNameAndMission(row.display_name, row.mission.uuid).then(
            async (file: FileWithTopicDto) => {
                await $router.push({
                    name: ROUTES.FILE.routeName,
                    params: {
                        file_uuid: file.uuid,
                        missionUuid: row.mission.uuid,
                        projectUuid: row.mission.project.uuid,
                    },
                });
            },
        );
        return;
    }

    await $router.push({
        name: ROUTES.FILES.routeName,
        params: {
            missionUuid: row.mission.uuid,
            projectUuid: row.mission.project.uuid,
        },
    });
}

function canDelete(row: FileQueueEntryDto): boolean {
    return (
        row.state !== QueueState.AWAITING_PROCESSING &&
        row.state !== QueueState.CANCELED &&
        row.state !== QueueState.ERROR &&
        row.state !== QueueState.CORRUPTED &&
        row.state !== QueueState.AWAITING_UPLOAD &&
        row.state !== QueueState.UNSUPPORTED_FILE_TYPE &&
        row.state !== QueueState.FILE_ALREADY_EXISTS
    );
}

async function downloadFile(row: FileQueueEntryDto): Promise<void> {
    await findOneByNameAndMission(row.display_name, row.mission.uuid).then(
        async (file: FileWithTopicDto) => {
            await _downloadFile(file.uuid, file.filename);
        },
    );
}

const columns = [
    {
        name: 'Project',
        required: true,
        label: 'Project',
        align: 'left',
        field: (row: FileQueueEntryDto): string => row.mission.project.name,
    },
    {
        name: 'Mission',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: FileQueueEntryDto): string => row.mission.name,
    },
    { name: 'Status', label: 'Status', align: 'left', field: 'state' },
    {
        name: 'Location',
        required: true,
        label: 'File Origin',
        align: 'left',
        field: 'location',
    },
    {
        name: 'Filename',
        required: true,
        label: 'Filename',
        align: 'left',
        field: (row: FileQueueEntryDto): string => {
            if (
                row.display_name === row.identifier &&
                row.location === FileLocation.DRIVE
            )
                return 'Not available';
            return row.display_name;
        },
    },
    {
        name: 'change',
        required: true,
        label: 'Last status update',
        align: 'left',
        field: (row: FileQueueEntryDto): string =>
            row.updatedAt ? formatDate(row.updatedAt, true) : 'error',
    },
    {
        name: 'Creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: FileQueueEntryDto): string => row.creator.name,
    },
    {
        name: 'action',
        required: true,
        label: '',
        align: 'center',
        field: 'Edit',
        style: 'width: 100px',
    },
    // {name: 'id', required: true, label: 'Google Drive File ID', align: 'left', field: 'identifier'},
];
</script>

<style scoped></style>
