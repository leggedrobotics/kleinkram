<template>
    <q-card-section>
        <q-table
            ref="tableRef"
            v-model:pagination="pagination"
            :rows="data"
            :columns="columns"
            row-key="uuid"
            :loading="loading"
            @row-click="
                (_, row) => router.push(ROUTES.ACTION.path + '/' + row.uuid)
            "
            flat
            bordered
            binary-state-sort
        >
            <template v-slot:body-cell-Status="props">
                <q-td :props="props">
                    <template
                        v-if="
                            props.row.state === ActionState.PROCESSING ||
                            props.row.state === ActionState.PENDING
                        "
                    >
                        <q-skeleton
                            class="q-pa-none q-ma-none"
                            style="background: none; margin-left: -3px"
                        >
                            <q-badge
                                :color="getColor(props.row.state)"
                                class="q-pa-sm"
                            >
                                {{ props.row.state }}
                            </q-badge>
                        </q-skeleton>
                    </template>

                    <template v-else>
                        <q-badge
                            :color="getColor(props.row.state)"
                            class="q-pa-sm"
                        >
                            {{ props.row.state }}
                        </q-badge>
                    </template>
                </q-td>
            </template>

            <template v-slot:body-cell-Details="props">
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
                                    clickable
                                    v-ripple
                                    @click="
                                        router.push(
                                            ROUTES.ACTION.path +
                                                '/' +
                                                props.row.uuid,
                                        )
                                    "
                                >
                                    <q-item-section
                                        >View Details
                                    </q-item-section>
                                </q-item>

                                <q-item clickable v-ripple disabled>
                                    <q-item-section
                                        >Cancel Action
                                    </q-item-section>
                                </q-item>
                                <q-item clickable v-ripple disabled>
                                    <q-item-section
                                        >Delete Action
                                    </q-item-section>
                                </q-item>
                            </q-list>
                        </q-menu>
                    </q-btn>
                </q-td>
            </template>
        </q-table>
    </q-card-section>
</template>

<script setup lang="ts">
import { QTable } from 'quasar';
import { useQuery } from '@tanstack/vue-query';
import { computed, ref, Ref, watch } from 'vue';
import { ActionState } from 'src/enums/QUEUE_ENUM';
import { formatDate } from 'src/services/dateFormating';
import { Action } from 'src/types/Action';
import { getActions } from 'src/services/queries/action';
import { useRouter } from 'vue-router';
import ROUTES from 'src/router/routes';
import ExplorerPageBreadcrumbs from 'components/explorer_page/ExplorerPageBreadcrumbs.vue';
import ManageProjectAccessButton from 'components/buttons/ManageProjectAccessButton.vue';
import DeleteProjectButton from 'components/buttons/DeleteProjectButton.vue';
import ButtonGroup from 'components/ButtonGroup.vue';
import MoveMissionButton from 'components/buttons/MoveMissionButton.vue';

const router = useRouter();

// list all props of the component
const props = defineProps<{
    project_uuid: string;
    mission_uuid: string;
}>();

const actions = useQuery<Action[]>({
    queryKey: ['action_mission', props.project_uuid, props.mission_uuid],
    queryFn: () => getActions(props.mission_uuid),
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

const data = actions.data;

const columns = [
    {
        name: 'Status',
        label: 'Status',
        align: 'left',
        field: 'state',
        sortable: true,
        style: 'width: 100px',
    },

    {
        name: 'Docker Image',
        label: 'Docker Image',
        align: 'left',
        sortable: true,
        field: (row: Action) => (row.docker_image ? row.docker_image : 'N/A'),
    },

    {
        name: 'reason',
        label: 'State Reason',
        align: 'left',
        sortable: true,
        field: (row: Action) => (row.state_cause ? row.state_cause : ''),
    },

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
        name: 'user',
        label: 'Submitted By',
        align: 'left',
        field: (row: Action) => row?.createdBy?.name || 'N/A',
        sortable: true,
    },
    {
        name: 'Details',
        label: '',
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
