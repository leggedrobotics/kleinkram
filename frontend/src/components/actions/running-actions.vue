<template>
    <div class="projects-container dashboard-card">
        <q-card class="full-width q-pa-md header-row" flat>
            <span style="font-size: larger">Running Actions</span>
            <div class="arrow-buttons">
                <q-btn
                    flat
                    icon="sym_o_arrow_outward"
                    class="scroll-button"
                    @click="toActions"
                />
            </div>
        </q-card>

        <q-separator />

        <div
            v-if="isFetched && actions && actions?.data?.length > 0"
            ref="cardWrapper"
            class="card-wrapper"
        >
            <q-table
                :rows="actions?.data"
                :columns="columns as any"
                :visible-columns="visibleColumns"
                :grid="$q.screen.xs"
                hide-pagination
                flat
                class="cursor-pointer"
                :class="$q.screen.xs ? 'q-pa-sm' : 'q-pa-md'"
                @row-click="handleRowClick"
            >
                <!--
                    On phones the table becomes a compact list of cards, so the
                    panel never scrolls sideways.
                -->
                <template #item="itemProps">
                    <div class="col-12 q-pa-xs">
                        <q-card
                            flat
                            bordered
                            class="cursor-pointer"
                            @click="() => openAction(itemProps.row.uuid)"
                        >
                            <q-card-section
                                class="row items-center no-wrap q-py-sm"
                            >
                                <div class="col" style="min-width: 0">
                                    <div class="text-weight-medium ellipsis">
                                        {{ actionName(itemProps.row) }}
                                    </div>
                                    <div
                                        class="text-caption text-grey-7 ellipsis"
                                    >
                                        {{ itemProps.row.mission.name }}
                                    </div>
                                </div>

                                <div class="col-auto q-ml-sm">
                                    <template
                                        v-if="
                                            itemProps.row.state ===
                                                ActionState.PROCESSING ||
                                            itemProps.row.state ===
                                                ActionState.PENDING
                                        "
                                    >
                                        <q-skeleton
                                            class="q-pa-none q-ma-none"
                                            style="background: none"
                                        >
                                            <q-badge
                                                :color="
                                                    getActionColor(
                                                        itemProps.row.state,
                                                    )
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
                                </div>
                            </q-card-section>
                        </q-card>
                    </div>
                </template>

                <template #body-cell-state="props">
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
            </q-table>
        </div>

        <div v-else class="empty-state-wrapper">
            <div class="empty-state-content">
                <q-icon name="sym_o_analytics" size="lg" color="grey-6" />
                <span class="text-h6 text-grey-7 q-mt-md">
                    No running actions
                </span>
                <span class="text-body1 text-grey-6 q-mt-sm">
                    Your running actions will appear here.
                </span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ActionDto } from '@kleinkram/api-dto/types/actions/action.dto';
import { ActionState } from '@kleinkram/shared';
import ActionBadge from 'components/action-badge.vue';
import { useQuasar } from 'quasar';
import { useRunningActions } from 'src/composables/use-actions-queries';
import ROUTES from 'src/router/routes';
import { getActionColor } from 'src/services/generic';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const $q = useQuasar();

const { data: actions, isFetched } = useRunningActions();

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
        field: (row: ActionDto): string => row.template.imageName,
    },
    {
        name: 'mission',
        label: 'Mission',
        align: 'left',
        sortable: false,
        field: (row: ActionDto): string => row.mission.name,
    },
    {
        name: 'name',
        label: 'Action Name',
        align: 'left',
        sortable: false,
        field: (row: ActionDto): string =>
            row.template.name === ''
                ? 'N/A'
                : `${row.template.name} v${row.template.version}`,
    },
    {
        name: 'user',
        label: 'Submitted By',
        align: 'left',
        field: (row: ActionDto): string => row.creator.name,
        sortable: false,
    },
];

/**
 * The docker image and the submitter do not fit on a small screen; the state,
 * the mission and the action name are the ones worth keeping.
 */
const visibleColumns = computed(() =>
    $q.screen.lt.md
        ? ['state', 'mission', 'name']
        : columns.map((column) => column.name),
);

const actionName = (action: ActionDto): string =>
    action.template.name === ''
        ? 'N/A'
        : `${action.template.name} v${action.template.version}`;

const toActions = async (): Promise<void> => {
    await router.push('/actions/runs');
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
.projects-container {
    grid-column: span 2;
    background-color: white;
    display: grid;
    grid-template-rows: 50px 2px auto;
}

.header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.arrow-buttons {
    display: flex;
    gap: 8px;
}

.card-wrapper {
    display: flex;
    gap: 3px;
    overflow-x: auto;
    height: 100%;
    margin-top: 0;
    padding-top: 0;
    scrollbar-width: none;
    flex-grow: 1;
}

.scroll-button {
    z-index: 1;
}

.empty-state-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;
    padding: 16px;
    flex-grow: 1;
}

.empty-state-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
}

/* The card list already fits the panel width on a phone */
@media (max-width: 599px) {
    .card-wrapper {
        overflow-x: hidden;
    }
}
</style>
