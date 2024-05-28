<template>
    <q-card-section>
        <q-table
            ref="tableRef"
            v-model:pagination="pagination"
            title="Analysis Runs"
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

            <template v-slot:body-cell-Details="props">
                <q-td :props="props">
                    <a :href="'#/analysis/' + props.row.uuid">
                        <q-btn color="primary" label="Details"></q-btn>
                    </a>
                </q-td>
            </template>
        </q-table>
    </q-card-section>
</template>

<script setup lang="ts">
import { QTable } from 'quasar';
import { useQuery } from '@tanstack/vue-query';
import { AnalysisRun } from 'src/types/types';
import { analysisRuns } from 'src/services/queries';
import { ref, Ref, watchEffect } from 'vue';
import { AnalysisRunState } from 'src/enum/QUEUE_ENUM';
import { formatDate } from 'src/services/dateFormating';

// list all props of the component
const props = defineProps<{
    project_uuid: string;
    run_uuid: string;
}>();

// watch for changes in props
watchEffect(() => {
    console.log(props.project_uuid);
    console.log(props.run_uuid);
});

const runs = useQuery<AnalysisRun[]>({
    queryKey: ['analysis_run', props.project_uuid, props.run_uuid],
    queryFn: () => analysisRuns(props.project_uuid, props.run_uuid),
    refetchInterval: 1000,
});

const tableRef: Ref<QTable | null> = ref(null);
const loading = ref(false);
const pagination = ref({
    sortBy: 'name',
    descending: false,
    page: 1,
    rowsPerPage: 10,
});

const data = runs.data;

const columns = [
    {
        name: 'Last Update',
        label: 'Last Update',
        align: 'left',
        sortable: true,
        field: (row: AnalysisRun) =>
            row.updatedAt ? formatDate(row.updatedAt, true) : 'N/A',
    },
    {
        name: 'Creation Date',
        label: 'Creation Date',
        align: 'left',
        sortable: true,
        field: (row: AnalysisRun) =>
            row.createdAt ? formatDate(row.createdAt, true) : 'N/A',
    },
    {
        name: 'Docker Image',
        label: 'Docker Image',
        align: 'left',
        sortable: true,
        field: (row: AnalysisRun) =>
            row.docker_image ? row.docker_image : 'N/A',
    },
    {
        name: 'Status',
        label: 'Status',
        align: 'left',
        field: 'state',
        sortable: true,
    },
    {
        name: 'Details',
        label: 'Details',
        align: 'left',
        field: 'uuid',
        sortable: false,
    },
];

function getColor(state: AnalysisRunState) {
    switch (state) {
        case AnalysisRunState.DONE:
            return 'green';
        case AnalysisRunState.FAILED:
            return 'red';
        case AnalysisRunState.PENDING:
            return 'orange';
        case AnalysisRunState.PROCESSING:
            return 'blue';
        default:
            return 'grey'; // Default color for unknown states
    }
}
</script>

<style scoped></style>
