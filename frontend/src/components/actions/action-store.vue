<template>
    <div class="h-full column">
        <div class="flex justify-between items-center q-mb-lg">
            <ButtonGroup>
                <q-toggle
                    v-model="showArchived"
                    label="Show Archived"
                    color="grey-7"
                    left-label
                    dense
                    class="text-grey-7 q-px-sm"
                />
            </ButtonGroup>

            <ButtonGroup>
                <app-search-bar
                    ref="searchInput"
                    v-model="searchTerm"
                    placeholder="Search Action Templates..."
                >
                    <template #append-start>
                        <div class="row items-center"></div>
                    </template>
                </app-search-bar>

                <app-create-button label="New Action" @click="handleCreate" />
            </ButtonGroup>
        </div>

        <div v-if="isLoading" class="flex flex-center col-grow">
            <q-spinner color="primary" size="3em" />
        </div>

        <q-table
            v-else-if="filteredTemplates.length > 0"
            :rows="filteredTemplates"
            :columns="columns"
            row-key="uuid"
            flat
            bordered
            separator="none"
            virtual-scroll
            :pagination="{ rowsPerPage: DEFAULT_PAGINATION_SIZE }"
            class="bg-white"
        >
            <template #body="props">
                <q-tr
                    :props="props"
                    class="cursor-pointer"
                    @click="() => handleRowClick(props.row)"
                >
                    <q-td
                        v-for="col in props.cols"
                        :key="col.name"
                        :props="props"
                    >
                        <div class="row items-center full-width">
                            <q-avatar
                                :color="
                                    props.row.archived ? 'grey-4' : 'grey-2'
                                "
                                :text-color="
                                    props.row.archived ? 'grey-7' : 'primary'
                                "
                                icon="sym_o_terminal"
                                class="q-mr-md"
                            />

                            <div class="column">
                                <div class="text-weight-bold">
                                    {{ props.row.name }}
                                    <q-badge
                                        v-if="props.row.archived"
                                        color="grey"
                                        label="Archived"
                                        class="q-ml-sm"
                                    />
                                </div>
                                <div class="text-caption text-grey-7">
                                    v{{ props.row.version }} •
                                    {{ props.row.creator?.name ?? 'System' }}
                                </div>
                            </div>

                            <q-space />

                            <div
                                class="row q-gutter-x-md text-caption text-grey gt-xs q-mr-lg"
                            >
                                <span>
                                    <q-icon name="sym_o_memory" />
                                    {{ props.row.cpuCores }} Core
                                </span>
                                <span
                                    v-if="props.row.gpuMemory > -1"
                                    class="text-deep-purple"
                                >
                                    <q-icon name="sym_o_grid_view" />
                                    GPU
                                </span>
                                <span>
                                    <q-icon name="sym_o_play_circle" />
                                    {{ props.row.executionCount }} Runs
                                </span>
                                <span>
                                    <q-icon name="sym_o_schedule" />
                                    {{ props.row.maxRuntime }}h
                                </span>
                            </div>

                            <div class="row q-gutter-x-sm">
                                <q-btn
                                    flat
                                    round
                                    dense
                                    icon="sym_o_history"
                                    color="grey-7"
                                    @click.stop="
                                        () => handleRevisions(props.row)
                                    "
                                >
                                    <q-tooltip>History</q-tooltip>
                                </q-btn>
                                <q-btn
                                    flat
                                    round
                                    dense
                                    icon="sym_o_edit"
                                    color="grey-7"
                                    @click.stop="() => handleEdit(props.row)"
                                >
                                    <q-tooltip>Edit</q-tooltip>
                                </q-btn>
                                <q-btn
                                    v-if="!props.row.archived"
                                    flat
                                    round
                                    dense
                                    icon="sym_o_play_arrow"
                                    color="primary"
                                    @click.stop="() => handleSelect(props.row)"
                                >
                                    <q-tooltip>Launch</q-tooltip>
                                </q-btn>
                                <q-btn
                                    v-if="!props.row.archived"
                                    flat
                                    round
                                    dense
                                    icon="sym_o_delete"
                                    color="negative"
                                    @click.stop="() => confirmDelete(props.row)"
                                >
                                    <q-tooltip>Delete</q-tooltip>
                                </q-btn>
                            </div>
                        </div>
                    </q-td>
                </q-tr>
            </template>
        </q-table>

        <div v-else class="flex flex-center q-pa-xl text-grey col-grow">
            <div class="column items-center text-center">
                <q-icon
                    :name="emptyState.icon"
                    size="4rem"
                    class="q-mb-md text-grey-4"
                />

                <span class="text-h6 text-grey-6">{{ emptyState.title }}</span>

                <span class="text-caption q-mb-md" style="max-width: 300px">
                    {{ emptyState.description }}
                </span>

                <q-btn
                    v-if="emptyState.actionLabel"
                    unelevated
                    color="primary"
                    :label="emptyState.actionLabel"
                    @click="emptyState.action"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ActionTemplateDto } from '@kleinkram/api-dto/types/actions/action-template.dto';
import ButtonGroup from 'components/buttons/button-group.vue';
import AppCreateButton from 'components/common/app-create-button.vue';
import AppSearchBar from 'components/common/app-search-bar.vue';
import { Dialog, Notify } from 'quasar';
import { useDeleteTemplate } from 'src/composables/use-action-mutations';
import { useTemplateList } from 'src/composables/use-actions-queries';
import { DEFAULT_PAGINATION_SIZE } from 'src/constants';
import DeleteActionTemplateDialog from 'src/dialogs/delete-action-template-dialog.vue';
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { useRoute, useRouter } from 'vue-router';

const emits = defineEmits<{
    (event: 'select' | 'edit' | 'revisions', template: ActionTemplateDto): void;
    (event: 'create'): void;
}>();

const router = useRouter();
const route = useRoute();

// --- State ---
const searchTerm = ref('');
const showArchived = ref(route.query.showArchived === 'true');
const searchInput = ref<any>(null);

import { QTableColumn } from 'quasar';

const columns: QTableColumn[] = [
    {
        name: 'template',
        label: 'Action Template',
        field: 'name',
        align: 'left',
    },
];

// --- Keyboard Shortcuts ---
const handleKeydown = (event: KeyboardEvent): void => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInput.value?.focus();
    }
};

onMounted(() => {
    globalThis.addEventListener('keydown', handleKeydown);
});
onUnmounted(() => {
    globalThis.removeEventListener('keydown', handleKeydown);
});

// --- URL Persistence ---
import { watch } from 'vue';
watch(showArchived, (value) => {
    const query = { ...route.query };
    if (value) {
        query.showArchived = 'true';
    } else {
        delete query.showArchived;
    }
    void router.replace({ query });
});

// --- Composable Hooks ---
const { data: templatesResult, isLoading } = useTemplateList(
    computed(() => ({
        search: '',
        includeArchived: showArchived.value,
    })),
);

// Delete mutation
const { mutateAsync: removeTemplate } = useDeleteTemplate();

// --- Client-Side Filtering & Grouping ---
const templates = computed(() => templatesResult.value?.data ?? []);

const latestTemplates = computed(() => {
    const groups: Record<string, ActionTemplateDto> = {};
    for (const t of templates.value) {
        const existing = groups[t.name];
        if (!existing || t.version > existing.version) {
            groups[t.name] = t;
        }
    }
    return Object.values(groups);
});

const filteredTemplates = computed(() => {
    if (!searchTerm.value) return latestTemplates.value;
    const lower = searchTerm.value.toLowerCase();
    return latestTemplates.value.filter((t) =>
        t.name.toLowerCase().includes(lower),
    );
});

// --- Event Handlers (Extracted to avoid inline handlers) ---
const clearSearch = (): void => {
    searchTerm.value = '';
};

const handleCreate = (): void => {
    emits('create');
};

const handleSelect = (template: ActionTemplateDto): void => {
    emits('select', template);
};

const handleRowClick = async (template: ActionTemplateDto): Promise<void> => {
    await router.push({
        path: '/actions/runs',
        query: {
            name: template.name,
            sortBy: 'createdAt',
            descending: 'true',
            projectUuid: '',
            missionUuid: '',
        },
    });
};

const handleEdit = (template: ActionTemplateDto): void => {
    emits('edit', template);
};

const handleRevisions = (template: ActionTemplateDto): void => {
    emits('revisions', template);
};

// --- Smart Empty State Logic ---
const emptyState = computed(() => {
    if (searchTerm.value) {
        return {
            icon: 'sym_o_search_off',
            title: 'No matches found',
            description: `We couldn't find any actions matching "${searchTerm.value}".`,
            actionLabel: 'Clear Search',
            action: clearSearch,
        };
    }

    if (showArchived.value) {
        return {
            icon: 'sym_o_archive',
            title: 'No archived actions',
            description: 'You do not have any archived action templates.',
            actionLabel: 'View Active Actions',
            action: (): boolean => (showArchived.value = false),
        };
    }

    return {
        icon: 'sym_o_rocket_launch',
        title: 'No actions defined',
        description:
            'Create your first action template to start automating your workflow.',
        actionLabel: 'Create New Action',
        action: handleCreate,
    };
});

// --- Delete Handler ---
// --- Delete Handler ---
const executeDelete = async (template: ActionTemplateDto): Promise<void> => {
    try {
        await removeTemplate(template.uuid);
        Notify.create({
            message: 'Action template deleted or archived successfully',
            color: 'positive',
            icon: 'sym_o_delete',
        });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : 'Unknown error occurred';
        Notify.create({
            message: `Failed to delete action: ${message}`,
            color: 'negative',
            icon: 'sym_o_error',
        });
    }
};

const confirmDelete = (template: ActionTemplateDto): void => {
    Dialog.create({
        component: DeleteActionTemplateDialog,
        componentProps: {
            template: template,
        },
    }).onOk(() => {
        void executeDelete(template);
    });
};
</script>
