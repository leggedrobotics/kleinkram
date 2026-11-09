<template>
    <q-table
        ref="tableReference"
        v-model:pagination="pagination"
        :rows="data"
        :columns="columns as any"
        :visible-columns="visibleColumns"
        :grid="$q.screen.xs"
        :rows-per-page-options="[10, 20, 50, 100]"
        row-key="uuid"
        :loading="isLoading"
        flat
        bordered
        binary-state-sort
        @row-click="handleRowClick"
        @request="setPagination"
    >
        <!--
            In card (grid) mode the column headers are gone, so sorting gets
            its own control on top of the list.
        -->
        <template v-if="$q.screen.xs" #top>
            <div class="row full-width items-center no-wrap q-gutter-x-sm">
                <q-select
                    v-model="mobileSortBy"
                    :options="sortOptions"
                    dense
                    outlined
                    emit-value
                    map-options
                    label="Sort by"
                    class="col"
                />
                <q-btn
                    flat
                    round
                    color="primary"
                    :icon="
                        pagination.descending
                            ? 'sym_o_arrow_downward'
                            : 'sym_o_arrow_upward'
                    "
                    :aria-label="
                        pagination.descending
                            ? 'Sorted descending, switch to ascending'
                            : 'Sorted ascending, switch to descending'
                    "
                    @click="toggleSortDirection"
                >
                    <q-tooltip>
                        {{ pagination.descending ? 'Descending' : 'Ascending' }}
                    </q-tooltip>
                </q-btn>
            </div>
        </template>

        <template #item="itemProps">
            <div class="col-12 q-pa-xs">
                <q-card
                    flat
                    bordered
                    class="cursor-pointer"
                    @click="() => openAction(itemProps.row.uuid)"
                >
                    <q-card-section class="row items-start no-wrap q-pb-xs">
                        <div class="col" style="min-width: 0">
                            <div class="text-weight-medium ellipsis">
                                {{ itemProps.row.template.name || 'N/A' }}
                            </div>
                            <div class="text-caption text-grey-7 ellipsis">
                                {{ itemProps.row.mission.name || 'N/A' }}
                            </div>
                        </div>

                        <div class="col-auto row items-center no-wrap">
                            <template
                                v-if="
                                    itemProps.row.state ===
                                        ActionState.PROCESSING ||
                                    itemProps.row.state === ActionState.PENDING
                                "
                            >
                                <q-skeleton
                                    class="q-pa-none q-ma-none"
                                    style="background: none"
                                >
                                    <q-badge
                                        :color="
                                            getActionColor(itemProps.row.state)
                                        "
                                        class="q-pa-sm"
                                    >
                                        {{ itemProps.row.state }}
                                    </q-badge>
                                </q-skeleton>
                            </template>
                            <template v-else>
                                <ActionBadge :action="itemProps.row" />
                            </template>

                            <q-btn
                                flat
                                round
                                icon="sym_o_more_vert"
                                unelevated
                                color="primary"
                                aria-label="Action options"
                                class="cursor-pointer q-ml-xs"
                                @click.stop
                            >
                                <q-menu auto-close>
                                    <q-list>
                                        <q-item
                                            v-ripple
                                            clickable
                                            @click="
                                                () =>
                                                    openAction(
                                                        itemProps.row.uuid,
                                                    )
                                            "
                                        >
                                            <q-item-section>
                                                View Details
                                            </q-item-section>
                                        </q-item>

                                        <q-item
                                            v-ripple
                                            clickable
                                            :disabled="
                                                !canCancel(itemProps.row.state)
                                            "
                                            @click="
                                                () =>
                                                    handleCancel(
                                                        itemProps.row.uuid,
                                                    )
                                            "
                                        >
                                            <q-item-section>
                                                Cancel Action
                                            </q-item-section>
                                        </q-item>
                                        <DeleteActionDialogOpener
                                            :action="itemProps.row"
                                        >
                                            <q-item v-ripple clickable>
                                                <q-item-section>
                                                    Delete Action
                                                </q-item-section>
                                            </q-item>
                                        </DeleteActionDialogOpener>
                                    </q-list>
                                </q-menu>
                            </q-btn>
                        </div>
                    </q-card-section>

                    <q-card-section class="q-pt-none text-caption text-grey-7">
                        <div class="row items-center q-gutter-x-sm">
                            <span>
                                {{
                                    itemProps.row.createdAt
                                        ? formatDate(
                                              itemProps.row.createdAt,
                                              true,
                                          )
                                        : 'N/A'
                                }}
                            </span>
                            <span v-if="itemProps.row.runtime">
                                · {{ formatDuration(itemProps.row.runtime) }}
                            </span>
                        </div>
                        <div v-if="itemProps.row.stateCause" class="ellipsis">
                            {{ itemProps.row.stateCause }}
                        </div>
                    </q-card-section>
                </q-card>
            </div>
        </template>

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
                        {{ noDataSubtitle }}
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
                                        router.push({
                                            name: ROUTES.ANALYSIS_DETAILS
                                                .routeName,
                                            params: { id: props.row.uuid },
                                        })
                                "
                            >
                                <q-item-section>View Details</q-item-section>
                            </q-item>

                            <q-item
                                v-ripple
                                clickable
                                :disabled="!canCancel(props.row.state)"
                                @click="() => handleCancel(props.row.uuid)"
                            >
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
import type { ActionDto } from '@kleinkram/api-dto/types/actions/action.dto';
import { ActionState, isCancellableActionState } from '@kleinkram/shared';
import ActionBadge from 'components/action-badge.vue';
import { QTable, useQuasar } from 'quasar';
import { useCancelAction } from 'src/composables/use-action-mutations';
import { useActionList } from 'src/composables/use-actions-queries';
import ROUTES from 'src/router/routes';
import { formatDate, formatDuration } from 'src/services/date-formating';
import { getActionColor } from 'src/services/generic';
import { QueryHandler, TableRequest } from 'src/services/query-handler';
import { computed, ref, Ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DeleteActionDialogOpener from '../button-wrapper/delete-action-dialog-opener.vue';

const router = useRouter();
const route = useRoute();
const $q = useQuasar();
const { mutateAsync: cancelAction } = useCancelAction();

const canCancel = (state: ActionState) => isCancellableActionState(state);

const handleCancel = async (uuid: string) => {
    try {
        await cancelAction(uuid);
        $q.notify({
            type: 'positive',
            message: 'Action cancellation requested',
        });
    } catch {
        $q.notify({
            type: 'negative',
            message: 'Failed to cancel action',
        });
    }
};

const properties = defineProps<{
    handler: QueryHandler;
}>();

properties.handler.setSort('createdAt');
properties.handler.setDescending(true);

const queryFilters = computed(() => ({
    projectUuid:
        (route.query.projectUuid as string) ||
        (route.params.projectUuid as string) ||
        undefined,
    missionUuid:
        (route.query.missionUuid as string) ||
        (route.params.missionUuid as string) ||
        undefined,
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

const noDataSubtitle = computed(() => {
    if (queryFilters.value.missionUuid && !queryFilters.value.templateName) {
        return 'No actions have been executed for this mission yet.';
    }
    return 'There are no executions matching your criteria.';
});

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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        field: (row: ActionDto) => row.stateCause ?? '',
    },
    {
        name: 'updatedAt',
        label: 'Last Update',
        align: 'left',
        sortable: true,
        field: (row: ActionDto) =>
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            row.updatedAt ? formatDate(row.updatedAt, true) : 'N/A',
    },
    {
        name: 'runtime',
        label: 'Duration',
        align: 'left',
        sortable: true,
        field: (row: ActionDto) =>
            row.runtime ? formatDuration(row.runtime) : 'N/A',
    },
    {
        name: 'createdAt',
        label: 'Creation Date',
        align: 'left',
        sortable: true,
        field: (row: ActionDto) =>
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            row.createdAt ? formatDate(row.createdAt, true) : 'N/A',
    },
    {
        name: 'creator.name',
        label: 'Submitted By',
        align: 'left',
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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

/**
 * Columns shown below `md`. The remaining ones (docker image, state reason,
 * creation date, submitted by) do not fit on a small screen and are dropped;
 * the essentials stay visible.
 */
const COMPACT_COLUMNS = [
    'state',
    'template.name',
    'mission.name',
    'updatedAt',
    'Details',
];

const visibleColumns = computed(() =>
    $q.screen.lt.md ? COMPACT_COLUMNS : columns.map((column) => column.name),
);

/**
 * In card mode (phones) the sortable column headers are not rendered, so the
 * sort field and direction are offered as a select plus a toggle button.
 */
const sortOptions = [
    { label: 'Creation Date', value: 'createdAt' },
    { label: 'Last Update', value: 'updatedAt' },
    { label: 'Status', value: 'state' },
    { label: 'Action Name', value: 'template.name' },
    { label: 'Mission', value: 'mission.name' },
    { label: 'Duration', value: 'runtime' },
];

const mobileSortBy = computed({
    get: () => properties.handler.sortBy,
    set: (value: string) => {
        properties.handler.setSort(value);
    },
});

const toggleSortDirection = (): void => {
    properties.handler.setDescending(!properties.handler.descending);
};

const openAction = async (uuid: string): Promise<void> => {
    await router.push({
        name: ROUTES.ANALYSIS_DETAILS.routeName,
        params: { id: uuid },
    });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleRowClick = async (_: Event, row: any): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    await openAction(row.uuid);
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
