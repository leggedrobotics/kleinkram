<template>
    <q-card>
        <q-card-section>
            <div class="col-12 col-md-3">
                <q-input
                    filled
                    v-model="startDate"
                    hint="File Processing since: "
                >
                    <template v-slot:prepend>
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

                    <template v-slot:append>
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
        </q-card-section>
        <q-card-section>
            <q-table
                ref="tableRef"
                v-model:pagination="pagination"
                title="File Processing Queue"
                :rows="queueEntries || []"
                :columns="columns"
                row-key="uuid"
                flat
                bordered
                :loading="isLoading"
                binary-state-sort
                @rowClick="rowClick"
            >
                <template v-slot:body-cell-Status="props">
                    <q-td :props="props">
                        <q-badge :color="getColor(props.row.state)">
                            <q-tooltip>
                                {{ getDetailedFileState(props.row.state) }}
                            </q-tooltip>
                            {{ getSimpleFileStateName(props.row.state) }}
                        </q-badge>
                    </q-td>
                </template>
            </q-table>
        </q-card-section>
    </q-card>
</template>

<script setup lang="ts">
import { QTable } from 'quasar';
import { useQuery } from '@tanstack/vue-query';
import { computed, inject, ref, Ref } from 'vue';
import { dateMask, formatDate, parseDate } from 'src/services/dateFormating';
import { FileLocation, FileState } from 'src/enums/QUEUE_ENUM';
import { Queue } from 'src/types/Queue';
import { Project } from 'src/types/Project';
import { currentQueue } from 'src/services/queries/queue';
import { FileEntity } from 'src/types/FileEntity';
import { findOneByNameAndMission } from 'src/services/queries/file';
import ROUTES from 'src/router/routes';
import RouterService from 'src/services/routerService';
import {
    getDetailedFileState,
    getSimpleFileStateName,
} from '../services/generic';
import { getColor } from 'src/services/generic';

const $routerService: RouterService | undefined = inject('$routerService');

const tableRef: Ref<QTable | null> = ref(null);
const now = new Date();
const startDate = ref(formatDate(new Date(now.getTime() - 1000 * 60 * 30)));
const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 10,
});
const { data: queueEntries, isLoading } = useQuery<Project[]>({
    queryKey: ['queue', startDate],
    queryFn: () => currentQueue(parseDate(startDate.value)),
    refetchInterval: 1000,
});

function rowClick(event: any, row: Queue) {
    const isFile =
        row.filename.endsWith('.bag') || row.filename.endsWith('.mcap');
    const isCompleted = row.state === FileState.COMPLETED;
    if (isFile && isCompleted) {
        findOneByNameAndMission(row.filename, row.mission.uuid).then(
            (file: FileEntity) => {
                $routerService?.routeTo(ROUTES.FILE, { uuid: file.uuid });
            },
        );
    }
}

const columns = [
    {
        name: 'Project',
        required: true,
        label: 'Project',
        align: 'left',
        field: (row: Queue) => row?.mission?.project?.name,
    },
    {
        name: 'Mission',
        required: true,
        label: 'Mission',
        align: 'left',
        field: (row: Queue) => row.mission.name,
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
        field: (row: Queue) => {
            if (
                row.filename == row.identifier &&
                row.location == FileLocation.DRIVE
            )
                return 'Not available';
            return row.filename;
        },
    },
    {
        name: 'change',
        required: true,
        label: 'Last status update',
        align: 'left',
        field: (row: Queue) =>
            row.updatedAt ? formatDate(row.updatedAt, true) : 'error',
    },
    {
        name: 'Creator',
        required: true,
        label: 'Creator',
        align: 'left',
        field: (row: Queue) => row?.creator?.name,
    },
    // {name: 'id', required: true, label: 'Google Drive File ID', align: 'left', field: 'identifier'},
];
</script>

<style scoped></style>
