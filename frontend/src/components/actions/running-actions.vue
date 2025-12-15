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
                hide-pagination
                class="q-pa-md cursor-pointer"
                @row-click="handleRowClick"
            >
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
import { useRunningActions } from 'src/composables/use-actions-queries';
import ROUTES from 'src/router/routes';
import { getActionColor } from 'src/services/generic';
import { useRouter } from 'vue-router';

const router = useRouter();

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

const toActions = async (): Promise<void> => {
    await router.push('/actions/runs');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleRowClick = async (_: Event, row: any): Promise<void> => {
    await router.push({
        name: ROUTES.ANALYSIS_DETAILS.routeName,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        params: { id: row.uuid },
    });
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
</style>
