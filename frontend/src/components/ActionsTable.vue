<template>
    <q-table
        ref="tableRef"
        v-model:pagination="pagination"
        :rows="data"
        :columns="columns as any"
        :rows-per-page-options="[10, 20, 50, 100]"
        row-key="uuid"
        :loading="loading"
        flat
        bordered
        binary-state-sort
        @row-click="
            (_, row) =>
                router.push({
                    name: ROUTES.ANALYSIS_DETAILS.routeName,
                    params: { id: row.uuid },
                })
        "
        @request="setPagination"
    >
        <template #body-cell-state="props">
            <q-td :props="props" class="truncate-cell">
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

        <template #body-cell-Details="props">
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
                                @click="
                                    () =>
                                        router.push('action/' + props.row.uuid)
                                "
                            >
                                <q-item-section>View Details</q-item-section>
                            </q-item>

                            <q-item v-ripple clickable disabled>
                                <q-item-section>Cancel Action</q-item-section>
                            </q-item>
                            <DeleteActionDialogOpener :action="props.row">
                                <q-item v-ripple clickable>
                                    <q-item-section>
                                        Delete Action
                                    </q-item-section>
                                </q-item>
                            </DeleteActionDialogOpener>
                        </q-list>
                    </q-menu>
                </q-btn>
            </q-td>
        </template>
    </q-table>
</template>

<script setup lang="ts">
import { QTable } from 'quasar';
import { computed, ref, Ref, watch } from 'vue';
import { formatDate } from 'src/services/dateFormating';
import { useRouter } from 'vue-router';
import ROUTES from 'src/router/routes';
import { QueryHandler, TableRequest } from 'src/services/QueryHandler';
import { getActionColor } from 'src/services/generic';
import { ActionState } from '@common/enum';
import { useActions } from '../hooks/customQueryHooks';
import ActionBadge from './ActionBadge.vue';
import DeleteActionDialogOpener from './button-wrapper/DeleteActionDialogOpener.vue';
import { ActionDto } from '@api/types/actions/action.dto';

const router = useRouter();

// list all props of the component
const properties = defineProps<{
    handler: QueryHandler;
}>();
properties.handler.setSort('createdAt');
properties.handler.setDescending(true);

const { data: rawData, isLoading } = useActions(
    properties.handler.projectUuid ?? '',
    properties.handler.missionUuid ?? '',
    properties.handler.take,
    properties.handler.skip,
    properties.handler.sortBy,
    properties.handler.descending,
    properties.handler.searchParams.name,
    JSON.stringify(properties.handler.queryKey) ?? '',
);
const tableRef: Ref<QTable | null> = ref(null);
const loading = ref(false);

function setPagination(update: TableRequest) {
    properties.handler.setPage(update.pagination.page);
    properties.handler.setTake(update.pagination.rowsPerPage);
    properties.handler.setSort(update.pagination.sortBy);
    properties.handler.setDescending(update.pagination.descending);
}

const pagination = computed(() => {
    return {
        page: properties.handler.page,
        rowsPerPage: properties.handler.take,
        rowsNumber: properties.handler.rowsNumber,
        sortBy: properties.handler.sortBy,
        descending: properties.handler.descending,
    };
});

const data = computed(() => (rawData.value ? rawData.value.data : []));
const total = computed(() => (rawData.value ? rawData.value.count : 0));
watch(
    () => total.value,
    () => {
        if (data.value && !isLoading.value) {
            // eslint-disable-next-line vue/no-mutating-props
            properties.handler.rowsNumber = total.value;
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
        field: (row: ActionDto) =>
            row.template.imageName ? row.template.imageName : 'N/A',
    },
    {
        name: 'mission',
        label: 'Mission',
        align: 'left',
        sortable: false,
        field: (row: ActionDto) => row.mission.name || 'N/A',
    },
    {
        name: 'name',
        label: 'Action Name',
        align: 'left',
        sortable: false,
        field: (row: ActionDto) =>
            row.template.name
                ? `${row.template.name} v${row.template.version}`
                : 'N/A',
    },

    {
        name: 'state_cause',
        label: 'State Reason',
        align: 'left',
        sortable: true,
        style:
            'max-width: 10vw;' +
            'overflow:hidden;' +
            'whitespace:nowrap;' +
            'text-overflow: ellipsis',

        field: (row: ActionDto) => (row.stateCause ? row.stateCause : ''),
    },

    {
        name: 'updatedAt',
        label: 'Last Update',
        align: 'left',
        sortable: true,
        field: (row: ActionDto) =>
            row.updatedAt ? formatDate(row.updatedAt, true) : 'N/A',
    },
    {
        name: 'createdAt',
        label: 'Creation Date',
        align: 'left',
        sortable: true,
        field: (row: ActionDto) =>
            row.createdAt ? formatDate(row.createdAt, true) : 'N/A',
    },
    {
        name: 'user',
        label: 'Submitted By',
        align: 'left',
        field: (row: ActionDto) => row.creator.name || 'N/A',
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

<style scoped>
.truncate-cell {
    max-width: 150px; /* Adjust as needed */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
