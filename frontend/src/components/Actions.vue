<template>
    <q-card-section>
        <q-table
            ref="tableRef"
            v-model:pagination="pagination"
            title="Actions"
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
                    <a :href="'#/action/' + props.row.uuid">
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
import { ref, Ref, watchEffect } from 'vue';
import { ActionState } from 'src/enum/QUEUE_ENUM';
import { formatDate } from 'src/services/dateFormating';
import { Action } from 'src/types/Action';
import { actions } from 'src/services/queries/action';

// list all props of the component
const props = defineProps<{
    project_uuid: string;
    mission_uuid: string;
}>();

const missions = useQuery<Action[]>({
    queryKey: ['action_mission', props.project_uuid, props.mission_uuid],
    queryFn: () => actions(props.project_uuid, props.mission_uuid),
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

const data = missions.data;

const columns = [
    {
        name: 'Last Update',
        label: 'Last Update',
        align: 'left',
        sortable: true,
        field: (row: Action) =>
            row.updatedAt ? formatDate(row.updatedAt, true) : 'N/A',
    },
    {
        name: 'Creation Date',
        label: 'Creation Date',
        align: 'left',
        sortable: true,
        field: (row: Action) =>
            row.createdAt ? formatDate(row.createdAt, true) : 'N/A',
    },
    {
        name: 'Docker Image',
        label: 'Docker Image',
        align: 'left',
        sortable: true,
        field: (row: Action) => (row.docker_image ? row.docker_image : 'N/A'),
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

function getColor(state: ActionState) {
    switch (state) {
        case ActionState.DONE:
            return 'green';
        case ActionState.FAILED:
            return 'red';
        case ActionState.PENDING:
            return 'orange';
        case ActionState.PROCESSING:
            return 'blue';
        default:
            return 'grey'; // Default color for unknown states
    }
}
</script>

<style scoped></style>
