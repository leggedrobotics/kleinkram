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
                        <q-icon name="event" class="cursor-pointer">
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
                        <q-icon name="access_time" class="cursor-pointer">
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
                :rows="data"
                :columns="columns"
                row-key="uuid"
                :loading="loading"
                binary-state-sort
            >
                <template v-slot:body-cell-Status="props">
                    <q-td :props="props">
                        <q-badge :color="getColor(props.row.state)">
                            {{ props.row.state }}
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
import { Project, Queue } from 'src/types/types';
import { currentQueue } from 'src/services/queries';
import { ref, Ref } from 'vue';
import { dateMask, formatDate, parseDate } from 'src/services/dateFormating';
import { FileLocation, FileState } from 'src/enum/QUEUE_ENUM';

const tableRef: Ref<QTable | null> = ref(null);
const loading = ref(false);
const now = new Date();
const startDate = ref(formatDate(new Date(now.getTime() - 1000 * 60 * 30)));
const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 10,
});
const queue = useQuery<Project[]>({
    queryKey: ['projects', startDate, Math.random()],
    queryFn: () => currentQueue(parseDate(startDate.value)),
    refetchInterval: 1000,
});

const data = queue.data;

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

function getColor(state: FileState) {
    switch (state) {
        case FileState.DONE:
            return 'green';
        case FileState.ERROR:
            return 'red';
        case FileState.PENDING:
            return 'yellow';
        case FileState.PROCESSING:
            return 'blue';
        case FileState.AWAITING_UPLOAD:
            return 'purple';
        default:
            return 'grey'; // Default color for unknown states
    }
}
</script>

<style scoped></style>
