<template>
    <div class="column q-gutter-y-md">
        <div
            :class="
                $q.screen.xs
                    ? 'column q-gutter-y-sm'
                    : 'flex justify-between items-center'
            "
        >
            <AppSearchBar
                v-model="searchTerm"
                placeholder="Search Action Triggers..."
                :style="$q.screen.xs ? undefined : 'min-width: 300px'"
            />
            <div
                class="row q-gutter-x-sm"
                :class="$q.screen.xs ? 'justify-end' : ''"
            >
                <AppRefreshButton @click="loadTriggers" />
                <AppCreateButton
                    label="New Trigger"
                    @click="openCreateDrawer"
                />
            </div>
        </div>

        <div v-if="isLoading" class="flex flex-center q-pa-lg">
            <q-spinner color="primary" size="3em" />
        </div>

        <q-table
            v-else-if="filteredTriggers.length > 0"
            :rows="filteredTriggers"
            :columns="columns"
            :visible-columns="visibleColumns"
            :grid="$q.screen.xs"
            row-key="uuid"
            flat
            bordered
            separator="none"
            class="bg-white"
            :pagination="{ rowsPerPage: 20 }"
        >
            <!-- Phones get a tappable card per trigger instead of a table -->
            <template #item="itemProps">
                <div class="col-12 q-pa-xs">
                    <q-card flat bordered>
                        <q-card-section class="row items-start no-wrap q-pb-xs">
                            <q-icon
                                :name="getTypeIcon(itemProps.row.type)"
                                size="sm"
                                class="q-mr-md q-mt-xs text-grey-7"
                            />
                            <div class="col" style="min-width: 0">
                                <div class="text-weight-bold ellipsis">
                                    {{ itemProps.row.name }}
                                </div>
                                <div class="text-caption text-grey-7">
                                    {{ itemProps.row.description }}
                                </div>
                                <div
                                    class="row items-center q-gutter-x-sm q-mt-xs"
                                >
                                    <q-badge
                                        color="grey-3"
                                        text-color="grey-9"
                                        :label="itemProps.row.type"
                                    />
                                    <span
                                        class="text-caption text-grey-7 ellipsis"
                                    >
                                        {{
                                            itemProps.row.templateName ||
                                            itemProps.row.templateUuid
                                        }}
                                    </span>
                                </div>
                            </div>
                        </q-card-section>

                        <q-card-actions align="right">
                            <q-btn
                                flat
                                round
                                icon="sym_o_edit"
                                color="grey-7"
                                aria-label="Edit trigger"
                                :disable="
                                    itemProps.row.creatorUuid !==
                                    currentUser?.uuid
                                "
                                @click="() => editTrigger(itemProps.row)"
                            >
                                <q-tooltip
                                    v-if="
                                        itemProps.row.creatorUuid ===
                                        currentUser?.uuid
                                    "
                                    >Edit</q-tooltip
                                >
                                <q-tooltip v-else
                                    >Only the creator can edit this
                                    trigger</q-tooltip
                                >
                            </q-btn>
                            <q-btn
                                flat
                                round
                                icon="sym_o_delete"
                                color="negative"
                                aria-label="Delete trigger"
                                :disable="
                                    itemProps.row.creatorUuid !==
                                    currentUser?.uuid
                                "
                                @click="() => confirmDelete(itemProps.row)"
                            >
                                <q-tooltip
                                    v-if="
                                        itemProps.row.creatorUuid ===
                                        currentUser?.uuid
                                    "
                                    >Delete</q-tooltip
                                >
                                <q-tooltip v-else
                                    >Only the creator can delete this
                                    trigger</q-tooltip
                                >
                            </q-btn>
                        </q-card-actions>
                    </q-card>
                </div>
            </template>
            <template #body="props">
                <q-tr :props="props">
                    <q-td key="name" :props="props">
                        <div class="row items-center">
                            <q-icon
                                :name="getTypeIcon(props.row.type)"
                                size="sm"
                                class="q-mr-md text-grey-7"
                            />
                            <div class="column">
                                <span class="text-weight-bold">{{
                                    props.row.name
                                }}</span>
                                <span class="text-caption text-grey-7">{{
                                    props.row.description
                                }}</span>
                            </div>
                        </div>
                    </q-td>
                    <q-td v-if="!$q.screen.lt.md" key="type" :props="props">
                        <q-badge
                            color="grey-3"
                            text-color="grey-9"
                            :label="props.row.type"
                        />
                    </q-td>
                    <q-td key="template" :props="props">
                        <span class="text-grey-8">{{
                            props.row.templateName || props.row.templateUuid
                        }}</span>
                    </q-td>
                    <q-td v-if="!$q.screen.lt.md" key="creator" :props="props">
                        <span class="text-grey-8">{{
                            props.row.creatorName || props.row.creatorUuid
                        }}</span>
                    </q-td>
                    <q-td key="actions" :props="props">
                        <div class="row justify-end q-gutter-x-sm">
                            <q-btn
                                flat
                                round
                                dense
                                icon="sym_o_edit"
                                color="grey-7"
                                :disable="
                                    props.row.creatorUuid !== currentUser?.uuid
                                "
                                @click="() => editTrigger(props.row)"
                            >
                                <q-tooltip
                                    v-if="
                                        props.row.creatorUuid ===
                                        currentUser?.uuid
                                    "
                                    >Edit</q-tooltip
                                >
                                <q-tooltip v-else
                                    >Only the creator can edit this
                                    trigger</q-tooltip
                                >
                            </q-btn>
                            <q-btn
                                flat
                                round
                                dense
                                icon="sym_o_delete"
                                color="negative"
                                :disable="
                                    props.row.creatorUuid !== currentUser?.uuid
                                "
                                @click="() => confirmDelete(props.row)"
                            >
                                <q-tooltip
                                    v-if="
                                        props.row.creatorUuid ===
                                        currentUser?.uuid
                                    "
                                    >Delete</q-tooltip
                                >
                                <q-tooltip v-else
                                    >Only the creator can delete this
                                    trigger</q-tooltip
                                >
                            </q-btn>
                        </div>
                    </q-td>
                </q-tr>
            </template>
        </q-table>

        <div v-else class="flex flex-center q-pa-xl text-grey col-grow">
            <div class="column items-center text-center">
                <q-icon
                    name="sym_o_bolt"
                    size="4rem"
                    class="q-mb-md text-grey-4"
                />
                <span class="text-h6 text-grey-6">No triggers found</span>
                <q-btn
                    v-if="!searchTerm"
                    unelevated
                    color="primary"
                    label="Create Trigger"
                    class="q-mt-md"
                    @click="openCreateDrawer"
                />
            </div>
        </div>

        <TriggerDefinitionDrawer
            :open="isDrawerOpen"
            :trigger-to-edit="selectedTrigger"
            @close="closeDrawer"
            @saved="loadTriggers"
        />
    </div>
</template>

<script setup lang="ts">
import type { ActionTriggerDto } from '@kleinkram/api-dto/types/actions/action-trigger.dto';
import type { CurrentAPIUserDto } from '@kleinkram/api-dto/types/user/current-api-user.dto';
import { TriggerType } from '@kleinkram/shared';
import AppCreateButton from 'components/common/app-create-button.vue';
import AppRefreshButton from 'components/common/app-refresh-button.vue';
import AppSearchBar from 'components/common/app-search-bar.vue';
import { QTableColumn, useQuasar } from 'quasar';
import { ActionService } from 'src/api/services/action.service';
import { useHandler } from 'src/hooks/query-hooks';
import { getUser } from 'src/services/auth';
import { computed, onMounted, ref } from 'vue';
import TriggerDefinitionDrawer from './trigger-definition-drawer.vue';

const $q = useQuasar();
const handler = useHandler();

// State
const triggers = ref<ActionTriggerDto[]>([]);
const isLoading = ref(false);
const searchTerm = ref('');
const isDrawerOpen = ref(false);
const selectedTrigger = ref<ActionTriggerDto | undefined>(undefined);
const currentUser = ref<CurrentAPIUserDto | null>(null);

// Columns
const columns: QTableColumn[] = [
    { name: 'name', label: 'Trigger Name', field: 'name', align: 'left' },
    { name: 'type', label: 'Type', field: 'type', align: 'left' },
    {
        name: 'template',
        label: 'Target Action Template',
        field: (row: ActionTriggerDto) => row.templateName ?? row.templateUuid,
        align: 'left',
    },
    { name: 'creator', label: 'Creator', field: 'creatorName', align: 'left' },
    { name: 'actions', label: '', field: 'actions', align: 'right' },
];

/**
 * Type and creator are dropped below `md`; the type is shown as a badge in
 * the phone card layout instead.
 */
const visibleColumns = computed(() =>
    $q.screen.lt.md
        ? ['name', 'template', 'actions']
        : columns.map((column) => column.name),
);

// Computed
const filteredTriggers = computed(() => {
    if (!searchTerm.value) return triggers.value;
    const lower = searchTerm.value.toLowerCase();
    return triggers.value.filter((t) => t.name.toLowerCase().includes(lower));
});

// Methods
const loadTriggers = async () => {
    isLoading.value = true;
    try {
        triggers.value = await ActionService.getTriggers(
            handler.value.missionUuid,
        );
    } catch {
        $q.notify({
            type: 'negative',
            message: 'Failed to load triggers',
        });
    } finally {
        isLoading.value = false;
    }
};

const getTypeIcon = (type: TriggerType) => {
    switch (type) {
        case TriggerType.WEBHOOK: {
            return 'sym_o_webhook';
        }
        case TriggerType.TIME: {
            return 'sym_o_schedule';
        }
        case TriggerType.FILE: {
            return 'sym_o_folder_open';
        }
        default: {
            return 'sym_o_bolt';
        }
    }
};

const openCreateDrawer = () => {
    selectedTrigger.value = undefined;
    isDrawerOpen.value = true;
};

const editTrigger = (trigger: ActionTriggerDto) => {
    selectedTrigger.value = trigger;
    isDrawerOpen.value = true;
};

const closeDrawer = () => {
    isDrawerOpen.value = false;
    selectedTrigger.value = undefined;
};

const confirmDelete = (trigger: ActionTriggerDto) => {
    $q.dialog({
        title: 'Delete Trigger',
        message: `Are you sure you want to delete trigger "${trigger.name}"?`,
        cancel: true,
        persistent: true,
    }).onOk(() => {
        void deleteTriggerConfirmed(trigger);
    });
};

const deleteTriggerConfirmed = async (trigger: ActionTriggerDto) => {
    try {
        await ActionService.deleteTrigger(trigger.uuid);
        $q.notify({
            type: 'positive',
            message: 'Trigger deleted successfully',
        });
        await loadTriggers();
    } catch {
        $q.notify({
            type: 'negative',
            message: 'Failed to delete trigger',
        });
    }
};

// Lifecycle
onMounted(async () => {
    currentUser.value = await getUser();
    void loadTriggers();
});
</script>
