<template>
    <q-table
        ref="tableReference"
        v-model:pagination="pagination"
        :rows="data"
        :columns="columns as any"
        :rows-per-page-options="[10, 20, 50, 100]"
        row-key="uuid"
        :loading="isLoading"
        flat
        bordered
        binary-state-sort
        @row-click="handleRowClick"
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

        <template #no-data>
            <div class="flex flex-center full-width q-pa-xl text-grey">
                <div class="column items-center text-center">
                    <q-icon
                        name="sym_o_toc"
                        size="4rem"
                        class="q-mb-md text-grey-4"
                    />
                    <span class="text-h6 text-grey-6">No executions found</span>
                    <span class="text-caption">
                        There are no executions matching your criteria.
                    </span>
                </div>
            </div>
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
import { ActionDto } from '@api/types/actions/action.dto';
import { ActionState } from '@common/enum';
import ActionBadge from 'components/action-badge.vue';
import { QTable } from 'quasar';
import { useActionList } from 'src/composables/use-actions-queries';
import ROUTES from 'src/router/routes';
import { formatDate } from 'src/services/date-formating';
import { getActionColor } from 'src/services/generic';
import { QueryHandler, TableRequest } from 'src/services/query-handler';
import { computed, ref, Ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DeleteActionDialogOpener from '../button-wrapper/delete-action-dialog-opener.vue';

const router = useRouter();
const route = useRoute();

const properties = defineProps<{
    handler: QueryHandler;
}>();

properties.handler.setSort('createdAt');
properties.handler.setDescending(true);

const queryFilters = computed(() => ({
    projectUuid: (route.query.projectUuid as string) || undefined,
    missionUuid: (route.query.missionUuid as string) || undefined,
    take: route.query.rowsPerPage ? Number(route.query.rowsPerPage) : 100,
    skip: route.query.page
        ? (Number(route.query.page) - 1) *
          (route.query.rowsPerPage ? Number(route.query.rowsPerPage) : 100)
        : 0,
    sortBy: (route.query.sortBy as string) || undefined,
    sortDirection: route.query.descending === 'true' ? 'DESC' : 'ASC',
    search: undefined,
    templateName: (route.query.name as string) || undefined,
}));

const { data: rawData, isLoading } = useActionList(queryFilters);

const tableReference: Ref<QTable | undefined> = ref(undefined);

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
        name: 'template.image_name',
        label: 'Docker Image',
        align: 'left',
        sortable: true,
        field: (row: ActionDto) => row.template.imageName ?? 'N/A',
    },
    {
        name: 'mission.name',
        label: 'Mission',
        align: 'left',
        sortable: true,
        field: (row: ActionDto) => row.mission.name || 'N/A',
    },
    {
        name: 'template.name',
        label: 'Action Name',
        align: 'left',
        sortable: true,
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
        field: (row: ActionDto) => row.stateCause ?? '',
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
        name: 'creator.name',
        label: 'Submitted By',
        align: 'left',
        field: (row: ActionDto) => row.creator.name ?? 'N/A',
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

const handleRowClick = async (_: Event, row: any): Promise<void> => {
    await router.push({
        name: ROUTES.ANALYSIS_DETAILS.routeName,
        params: { id: row.uuid },
    });
};
</script>

<style scoped>
.truncate-cell {
    max-width: 150px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
