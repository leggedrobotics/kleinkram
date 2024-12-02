<template>
    <div
        class="projects-container dashboard-card"
        style="grid-column: span 2; background-color: white; display: grid"
    >
        <!-- Static Row with Title and Arrows -->
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

        <!-- Scrollable Card Section -->
        <div
            v-if="isFetched && actions && actions.length > 0"
            ref="cardWrapper"
            class="card-wrapper"
        >
            <q-table
                :rows="actions"
                :columns="columns as any"
                hide-pagination
                class="q-pa-md"
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
        <div v-else style="height: 85%">
            <q-card flat class="full-height">
                <q-card-section class="q-pa-md full-height">
                    <q-item>
                        <q-item-section>
                            <q-item-label>
                                <q-icon name="sym_o_info" />
                                No running actions
                            </q-item-label>
                        </q-item-section>
                    </q-item>
                </q-card-section>
            </q-card>
        </div>
    </div>
</template>
<script setup lang="ts">
import { getActionColor } from 'src/services/generic';
import ActionBadge from 'components/ActionBadge.vue';
import { useRouter } from 'vue-router';
import { ActionState } from '@common/enum';
import { ActionDto } from '@api/types/Actions.dto';
import { useRunningActions } from '../hooks/customQueryHooks';

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
            row.template.name !== ''
                ? `${row.template.name} v${row.template.version}`
                : 'N/A',
    },

    {
        name: 'user',
        label: 'Submitted By',
        align: 'left',
        field: (row: ActionDto): string => row.creator.name,
        sortable: false,
    },
];

const toActions = async () => {
    return await router.push('actions');
};
</script>

<style scoped>
.projects-container {
    grid-column: 1 / 3;
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
    gap: 3px; /* Spacing between cards */
    overflow-x: auto; /* Enable horizontal scrolling */
    height: 100%;
    margin-top: 0;
    padding-top: 0;
    scrollbar-width: none;
}

.scroll-button {
    z-index: 1;
}
</style>
