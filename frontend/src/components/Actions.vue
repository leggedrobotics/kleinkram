<template>
    <q-table
        ref="tableRef"
        v-model:pagination="pagination"
        :rows="data"
        :columns="columns"
        :rows-per-page-options="[10, 20, 50, 100]"
        row-key="uuid"
        :loading="loading"
        @row-click="
            (_, row) =>
                router.push({
                    name: ROUTES.ANALYSIS_DETAILS.routeName,
                    params: { id: row.uuid },
                })
        "
        flat
        bordered
        binary-state-sort
        @request="setPagination"
    >
        <template v-slot:body-cell-state="props">
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
                            :color="getActionColor(props.row.state)"
                            class="q-pa-sm"
                        >
                            {{ props.row.state }}
                        </q-badge>
                    </q-skeleton>
                </template>

                <template v-else>
                    <ActionBadge :action="props.row" />
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
                                @click="router.push('action/' + props.row.uuid)"
                            >
                                <q-item-section>View Details </q-item-section>
                            </q-item>

                            <q-item clickable v-ripple disabled>
                                <q-item-section>Cancel Action </q-item-section>
                            </q-item>
                            <q-item clickable v-ripple disabled>
                                <q-item-section>Delete Action </q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-btn>
            </q-td>
        </template>
    </q-table>
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
import { QueryHandler, TableRequest } from 'src/services/QueryHandler';
import { getActionColor } from 'src/services/generic';
import ActionBadge from 'components/ActionBadge.vue';

const router = useRouter();

// list all props of the component
const props = defineProps<{
    handler: QueryHandler;
}>();
props.handler.setSort('createdAt');
props.handler.setDescending(true);
const actionKey = computed(() => [
    'action_mission',
    props.handler.mission_uuid,
    props.handler.queryKey,
]);
const { data: rawData, isLoading } = useQuery<[Action[], number]>({
    queryKey: actionKey,
    queryFn: () =>
        getActions(
            props.handler.project_uuid as string,
            props.handler.mission_uuid as string,
            props.handler.take,
            props.handler.skip,
            props.handler.sortBy,
            props.handler.descending,
        ),
    staleTime: 0,
    refetchInterval: 4000,
});

const tableRef: Ref<QTable | null> = ref(null);
const loading = ref(false);

function setPagination(update: TableRequest) {
    props.handler?.setPage(update.pagination.page);
    props.handler?.setTake(update.pagination.rowsPerPage);
    props.handler?.setSort(update.pagination.sortBy);
    props.handler?.setDescending(update.pagination.descending);
}

const pagination = computed(() => {
    return {
        page: props.handler.page,
        rowsPerPage: props.handler.take,
        rowsNumber: props.handler?.rowsNumber,
        sortBy: props.handler?.sortBy,
        descending: props.handler?.descending,
    };
});

const data = computed(() => (rawData.value ? rawData.value[0] : []));
const total = computed(() => (rawData.value ? rawData.value[1] : 0));
watch(
    () => total.value,
    () => {
        if (data.value && !isLoading.value) {
            props.handler.rowsNumber = total.value;
        }
    },
    { immediate: true },
);
const columns = [
    {
        name: 'state',
        label: 'Status',
        align: 'left',
        field: 'state',
        sortable: true,
        style: 'width: 100px',
    },

    {
        name: 'image',
        label: 'Docker Image',
        align: 'left',
        sortable: false,
        field: (row: Action) =>
            row.template?.image_name ? row.template.image_name : 'N/A',
    },
    {
        name: 'mission',
        label: 'Mission',
        align: 'left',
        sortable: false,
        field: (row: Action) => row.mission?.name || 'N/A',
    },
    {
        name: 'name',
        label: 'Action Name',
        align: 'left',
        sortable: false,
        field: (row: Action) =>
            row.template?.name
                ? row.template.name + ' v' + row.template.version
                : 'N/A',
    },

    {
        name: 'state_cause',
        label: 'State Reason',
        align: 'left',
        sortable: true,
        field: (row: Action) => (row.state_cause ? row.state_cause : ''),
    },

    {
        name: 'updatedAt',
        label: 'Last Update',
        align: 'left',
        sortable: true,
        field: (row: Action) =>
            row.updatedAt ? formatDate(row.updatedAt, true) : 'N/A',
    },
    {
        name: 'createdAt',
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
        sortable: false,
    },
    {
        name: 'Details',
        label: '',
        align: 'left',
        field: 'uuid',
        sortable: false,
    },
];
</script>

<style scoped></style>
