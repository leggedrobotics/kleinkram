<template>
    <div class="q-pa-md h-full column">
        <div class="row q-col-gutter-md q-mb-lg items-center justify-between">
            <div class="col-grow col-md-5">
                <q-input
                    ref="searchInput"
                    v-model="searchTerm"
                    outlined
                    dense
                    placeholder="Search Action Templates..."
                    debounce="300"
                    bg-color="white"
                    class="shadow-1"
                >
                    <template #prepend>
                        <q-icon name="sym_o_search" />
                    </template>
                    <template #append>
                        <div class="row items-center">
                            <q-chip
                                dense
                                square
                                outline
                                color="grey-5"
                                size="xs"
                                class="q-px-sm gt-xs"
                            >
                                <span
                                    class="text-caption"
                                    style="font-size: 10px"
                                >
                                    {{ isMac ? '⌘K' : 'Ctrl+K' }}
                                </span>
                            </q-chip>
                            <q-icon
                                v-if="searchTerm"
                                name="sym_o_cancel"
                                class="cursor-pointer q-ml-sm"
                                @click="clearSearch"
                            />
                        </div>
                    </template>
                </q-input>
            </div>

            <div class="col-auto row items-center q-gutter-x-md">
                <q-toggle
                    v-model="showArchived"
                    label="Show Archived"
                    color="grey-7"
                    left-label
                    dense
                    class="text-grey-7"
                />

                <q-separator vertical inset />

                <q-btn-toggle
                    v-model="viewMode"
                    unelevated
                    dense
                    text-color="grey-6"
                    toggle-text-color="primary"
                    :options="[
                        { icon: 'sym_o_grid_view', value: 'grid' },
                        { icon: 'sym_o_view_list', value: 'list' },
                    ]"
                    class="border-grey"
                />

                <q-btn
                    color="primary"
                    icon="sym_o_add"
                    label="New Action"
                    unelevated
                    @click="handleCreate"
                />
            </div>
        </div>

        <div v-if="isLoading" class="flex flex-center col-grow">
            <q-spinner color="primary" size="3em" />
        </div>

        <div
            v-else-if="viewMode === 'grid' && filteredTemplates.length > 0"
            class="row q-col-gutter-md"
        >
            <div
                v-for="template in filteredTemplates"
                :key="template.uuid"
                class="col-xs-12 col-sm-6 col-md-4 col-lg-3 flex"
            >
                <ActionCard
                    :template="template"
                    @run="() => handleSelect(template)"
                    @edit="() => handleEdit(template)"
                    @revisions="() => handleRevisions(template)"
                    @delete="() => confirmDelete(template)"
                />
            </div>
        </div>

        <q-list
            v-else-if="viewMode === 'list' && filteredTemplates.length > 0"
            separator
            bordered
            class="bg-white rounded-borders"
        >
            <q-item
                v-for="template in filteredTemplates"
                :key="template.uuid"
                v-ripple
                clickable
                class="q-py-md"
                @click="() => handleSelect(template)"
            >
                <q-item-section avatar>
                    <q-avatar
                        :color="template.archived ? 'grey-4' : 'grey-2'"
                        :text-color="template.archived ? 'grey-7' : 'primary'"
                        icon="sym_o_terminal"
                    />
                </q-item-section>

                <q-item-section>
                    <q-item-label class="text-weight-bold">
                        {{ template.name }}
                        <q-badge
                            v-if="template.archived"
                            color="grey"
                            label="Archived"
                            class="q-ml-sm"
                        />
                    </q-item-label>
                    <q-item-label caption>
                        v{{ template.version }} •
                        {{ template.creator?.name ?? 'System' }}
                    </q-item-label>
                </q-item-section>

                <q-item-section side class="gt-xs">
                    <div class="row q-gutter-x-md text-caption text-grey">
                        <span>
                            <q-icon name="sym_o_memory" />
                            {{ template.cpuCores }} Core
                        </span>
                        <span>
                            <q-icon name="sym_o_schedule" />
                            {{ template.maxRuntime }}h
                        </span>
                    </div>
                </q-item-section>

                <q-item-section side>
                    <div class="row q-gutter-x-sm">
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_history"
                            color="grey-7"
                            @click.stop="() => handleRevisions(template)"
                        />
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_edit"
                            color="grey-7"
                            :disable="template.archived"
                            @click.stop="() => handleEdit(template)"
                        />
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_play_arrow"
                            color="primary"
                            :disable="template.archived"
                            @click.stop="() => handleSelect(template)"
                        />
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_delete"
                            color="negative"
                            @click.stop="() => confirmDelete(template)"
                        />
                    </div>
                </q-item-section>
            </q-item>
        </q-list>

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
import { ActionTemplateDto } from '@api/types/actions/action-template.dto';
import ActionCard from 'components/actions/action-card.vue';
import { Dialog, Notify, Platform } from 'quasar';
import { useDeleteTemplate } from 'src/composables/use-action-mutations';
import { useTemplateList } from 'src/composables/use-actions-queries';
import { computed, onMounted, onUnmounted, ref } from 'vue';

const emits = defineEmits<{
    (event: 'select' | 'edit' | 'revisions', template: ActionTemplateDto): void;
    (event: 'create'): void;
}>();

// --- State ---
const searchTerm = ref('');
const showArchived = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);
const viewMode = ref<'grid' | 'list'>('grid');

const isMac = computed(() => Platform.is.mac);

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
const executeDelete = async (template: ActionTemplateDto): Promise<void> => {
    try {
        await removeTemplate(template.uuid);
        Notify.create({
            message: 'Action template deleted or archived successfully',
            color: 'positive',
            icon: 'sym_o_delete',
        });
    } catch (error: any) {
        Notify.create({
            message: error.response?.data?.message || 'Failed to delete action',
            color: 'negative',
        });
    }
};

const confirmDelete = (template: ActionTemplateDto): void => {
    Dialog.create({
        title: 'Delete Action Template',
        message: `Are you sure you want to delete "${template.name}" (v${template.version})?`,
        html: true,
        ok: { label: 'Delete', color: 'negative', flat: true },
        cancel: true,
        persistent: true,
    }).onOk(() => {
        void executeDelete(template);
    });
};
</script>
