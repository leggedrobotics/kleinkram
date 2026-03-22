<template>
    <div
        class="mission-files-container"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
    >
        <div v-if="isDragging" class="drop-overlay">
            <q-icon name="sym_o_upload" size="4rem" color="white" />
            <div class="text-h4 text-white q-mt-md">Drop files to upload</div>
        </div>

        <div
            v-if="selectedFiles.length === 0"
            class="q-my-lg flex justify-between items-center"
        >
            <Suspense>
                <ExplorerPageTableHeader
                    v-if="handler"
                    :url-handler="handler"
                />

                <template #fallback>
                    <div style="width: 550px; height: 67px">
                        <q-skeleton
                            class="q-mr-md q-mb-sm q-mt-sm"
                            style="width: 300px; height: 20px"
                        />
                        <q-skeleton
                            class="q-mr-md"
                            style="width: 200px; height: 18px"
                        />
                    </div>
                </template>
            </Suspense>
            <div
                class="q-pa-md bg-grey-1 rounded-borders border-grey-3"
                style="border: 1px solid #e0e0e0; flex-grow: 1"
            >
                <div class="row items-start no-wrap q-gutter-x-sm">
                    <div class="col">
                        <SmartSearchInput
                            :model-value="filterText"
                            :provider="provider"
                            :context-data="contextData"
                            :highlight-keys="highlightKeys"
                            :placeholder="placeholderText"
                            :validator="validateSyntax"
                            @update:model-value="onFilterUpdate"
                            @submit="refresh"
                            @toggle-advanced="toggleAdvanced"
                        />
                    </div>
                    <div class="col-auto">
                        <q-btn
                            flat
                            class="bg-button-secondary text-on-color"
                            icon="sym_o_search"
                            label="Search"
                            @click="refresh"
                        />
                    </div>
                    <div class="col-auto">
                        <create-file-dialog-opener
                            :mission="missionData as MissionWithFilesDto"
                        >
                            <app-create-button
                                label="Upload File"
                                icon="sym_o_upload"
                            />
                        </create-file-dialog-opener>
                    </div>
                </div>

                <q-slide-transition>
                    <div v-if="showAdvanced">
                        <q-separator class="q-my-sm" />
                        <!-- @ts-ignore - Generic mismatch on props -->
                        <ComposableFilterPopup
                            :filters="filters"
                            :state="state"
                            :context="contextData"
                            @reset="resetFilter"
                        />
                    </div>
                </q-slide-transition>
            </div>
        </div>
        <div v-else class="q-py-lg" style="background: #0f62fe">
            <ButtonGroupOverlay>
                <template #start>
                    <div style="margin: 0; font-size: 14pt; color: white">
                        {{ selectedFiles.length }}
                        {{ selectedFiles.length === 1 ? 'file' : 'files' }}
                        selected
                    </div>
                </template>
                <template v-if="missionData" #end>
                    <klein-download-files
                        :files="selectedFiles"
                        style="max-width: 300px"
                    />
                    <OpenMultCategoryAdd
                        :mission="missionData"
                        :files="selectedFiles"
                    />
                    <OpenMultiFileMoveDialog
                        :mission="missionData"
                        :files="selectedFiles"
                    />

                    <q-btn
                        flat
                        dense
                        padding="6px"
                        icon="sym_o_download"
                        color="white"
                        @click="downloadCallback"
                    >
                        Download
                    </q-btn>
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        icon="sym_o_delete"
                        color="white"
                        @click="deleteFilesCallback"
                    >
                        Delete
                    </q-btn>
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        icon="sym_o_close"
                        color="white"
                        @click="deselect"
                    />
                </template>
            </ButtonGroupOverlay>
        </div>
        <div>
            <Suspense>
                <explorer-page-files-table
                    v-if="handler"
                    v-model:selected="selectedFiles"
                    @reset-filter="resetFilter"
                />

                <template #fallback>
                    <div style="width: 100%; height: 645px">
                        <q-skeleton
                            class="q-mr-md q-mb-sm q-mt-sm"
                            style="width: 100%; height: 40px"
                        />

                        <div v-for="i in 20" :key="i" class="q-mt-sm">
                            <q-skeleton
                                class="q-mr-md q-mb-sm"
                                style="width: 100%; height: 20px; opacity: 0.5"
                            />
                        </div>
                    </div>
                </template>
            </Suspense>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import type { FileUploadDto } from '@kleinkram/api-dto/types/upload.dto';
import { FileType } from '@kleinkram/shared';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import CreateFileDialogOpener from 'components/button-wrapper/dialog-opener-create-file.vue';
import ButtonGroupOverlay from 'components/buttons/button-group-overlay.vue';
import OpenMultCategoryAdd from 'components/buttons/open-mult-category-add-dialog-button.vue';
import OpenMultiFileMoveDialog from 'components/buttons/open-multi-file-move-dialog-button.vue';
import KleinDownloadFiles from 'components/cli-links/klein-download-files.vue';
import AppCreateButton from 'components/common/app-create-button.vue';
import ExplorerPageFilesTable from 'components/explorer-page/explorer-page-files-table.vue';
import ExplorerPageTableHeader from 'components/explorer-page/explorer-page-table-header.vue';
import { Notify, useQuasar } from 'quasar';
import SmartSearchInput from 'src/components/common/smart-search-input.vue';
import ComposableFilterPopup from 'src/components/files/filter/composable-filter-popup.vue';
import { KEYWORDS, useFilterParser } from 'src/composables/use-filter-parser';
import {
    DEFAULT_MISSION_STATE,
    useMissionFileFilter,
} from 'src/composables/use-mission-file-filter';
import {
    MissionFileSearchContextData,
    useMissionFileSearch,
} from 'src/composables/use-mission-file-search';
import ConfirmDeleteDialog from 'src/dialogs/confirm-delete-dialog.vue';
import ConfirmDeleteFileDialog from 'src/dialogs/confirm-delete-file-dialog.vue';
import CreateFileDialog from 'src/dialogs/create-file-dialog.vue';
import {
    registerNoPermissionErrorHandler,
    useHandler,
    useMission,
} from 'src/hooks/query-hooks';
import { useMissionUUID, useProjectUUID } from 'src/hooks/router-hooks';
import { _downloadFiles } from 'src/services/generic';
import { deleteFiles } from 'src/services/mutations/file';
import { computed, inject, onMounted, Ref, ref, watch } from 'vue';

const uploads = inject<Ref<FileUploadDto[]>>('uploads');

const queryClient = useQueryClient();
const handler = useHandler();
const $q = useQuasar();

const projectUuid = useProjectUUID();
const missionUuid = useMissionUUID();

const {
    data: missionData,
    isLoadingError,
    error: missionError,
} = useMission(
    missionUuid,
    (error: unknown) => {
        const errorMessage =
            (error as { response?: { data?: { message?: string } } }).response
                ?.data?.message ?? 'Unknown error';

        Notify.create({
            message: `Error fetching Mission: ${errorMessage}`,
            color: 'negative',
            timeout: 2000,
            position: 'bottom',
        });
        handler.value.setMissionUUID(undefined);
        return false;
    },
    200,
);
registerNoPermissionErrorHandler(
    isLoadingError,
    missionUuid,
    'mission',
    missionError,
);

// --- Filter Logic ---
const missionFileFilter = useMissionFileFilter();
const { state } = missionFileFilter;
const showAdvanced = ref(false);

const files = computed(
    () => missionData.value?.files as FileWithTopicDto[] | undefined,
);

const { provider, filters, contextData, availableCategories } =
    useMissionFileSearch(projectUuid, files);

function toggleAdvanced() {
    showAdvanced.value = !showAdvanced.value;
}

const placeholderText = computed(() => {
    const cat =
        availableCategories.value.length > 0
            ? (availableCategories.value[0]?.name ?? 'MyCat')
            : 'MyCat';
    const catString = cat.includes(' ') ? `"${cat}"` : cat;
    return `Search (e.g. health:healthy category:${catString} filetype:bag ...)`;
});

// Keys for highlighting
const highlightKeys = computed(() => [
    ...filters.map((f) => f.key),
    KEYWORDS.TOPIC_AND,
]);

// Parser integration
const isUpdatingFromInput = ref(false);
const defaultState = DEFAULT_MISSION_STATE();

const { filterString, parse, validateSyntax } = useFilterParser(
    // @ts-ignore - Generic state mismatch but structurally compatible for the parser
    state,
    // @ts-ignore
    filters,
    () => contextData.value as unknown as MissionFileSearchContextData,
    {
        defaultStartDate: defaultState.startDates,
        defaultEndDate: defaultState.endDates,
    },
);

const filterText = ref('');

// Watch for internal filter changes
// (e.g. from Advanced UI) to update text
watch(filterString, (newValue) => {
    if (!isUpdatingFromInput.value && newValue !== filterText.value) {
        filterText.value = newValue;
    }
});

// Initial sync
onMounted(() => {
    if (filterString.value) {
        filterText.value = filterString.value;
    }
});

function onFilterUpdate(value: string) {
    filterText.value = value;
    isUpdatingFromInput.value = true;
    parse(value);
    setTimeout(() => {
        isUpdatingFromInput.value = false;
    }, 0);
}

function resetFilter(): void {
    missionFileFilter.resetFilter();
    filterText.value = '';
    refresh();
}

function refresh(): void {
    // Sync state to Handler
    const {
        startDates,
        endDates,
        filter,
        health,
        categories,
        selectedTopics,
        selectedDatatypes,
    } = state;
    const defaults = DEFAULT_MISSION_STATE();

    const finalStart = startDates === defaults.startDates ? '' : startDates;
    const finalEnd = endDates === defaults.endDates ? '' : endDates;

    handler.value.setSearch({
        name: filter, // The filename filter
        health: health ?? '',
        startDate: finalStart,
        endDate: finalEnd,
        topics: selectedTopics.length > 0 ? selectedTopics.join(',') : '',
        messageDatatypes:
            selectedDatatypes.length > 0 ? selectedDatatypes.join(',') : '',
        matchAllTopics: state.matchAllTopics.toString(),
    });
    // @ts-ignore
    handler.value.setCategories(categories);

    // Trigger Query Invalidation
    void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'files',
    });
}

// Watch filters to auto-refresh
watch(
    [
        () => state.filter,
        () => state.health,
        () => state.categories,
        () => state.startDates,
        () => state.endDates,
        () => state.fileTypeFilter,
        () => state.selectedTopics,
        () => state.selectedDatatypes,
        () => state.matchAllTopics,
        () => state.tagFilter,
    ],
    () => {
        refresh();
    },
    { deep: true },
);

// --- Selection Logic ---
const selectedFiles: Ref<FileWithTopicDto[]> = ref([]);

watch(
    () => state.fileTypeFilter,
    (options) => {
        if (!options) {
            handler.value.setFileTypes([]);
            return;
        }
        const selectedTypes = options
            .filter((option) => option.value)
            .map((option) => option.name as FileType);
        handler.value.setFileTypes(selectedTypes);
    },
    { deep: true },
);

const { mutate: _deleteFiles } = useMutation({
    mutationFn: (update: { fileUUIDs: string[]; missionUUID: string }) =>
        deleteFiles(update.fileUUIDs, update.missionUUID),
    onSuccess: async () => {
        Notify.create({
            message: 'Files deleted successfully',
            color: 'positive',
            timeout: 2000,
            position: 'bottom',
        });
        refresh();
        selectedFiles.value = [];
        await Promise.resolve();
    },
    onError: (error: unknown) => {
        const errorMessage =
            (
                error as {
                    response?: { data?: { message?: string } };
                }
            ).response?.data?.message ?? '';

        Notify.create({
            message: `Error deleting files: ${errorMessage}`,
            color: 'negative',
            timeout: 2000,
            position: 'bottom',
        });
    },
});

const deleteFilesCallback = (): void => {
    if (selectedFiles.value.length === 1) {
        $q.dialog({
            component: ConfirmDeleteFileDialog,
            componentProps: {
                filename: selectedFiles.value.map((file) => file.filename)[0],
            },
        }).onOk(() => {
            const fileUUIDs = selectedFiles.value.map((file) => file.uuid);
            _deleteFiles({
                fileUUIDs,
                missionUUID: missionUuid.value ?? '',
            });
            deselect();
        });
    } else {
        $q.dialog({
            component: ConfirmDeleteDialog,
            componentProps: {
                filenames: selectedFiles.value.map((file) => file.filename),
            },
        }).onOk(() => {
            const fileUUIDs = selectedFiles.value.map((file) => file.uuid);
            _deleteFiles({
                fileUUIDs,
                missionUUID: missionUuid.value ?? '',
            });
            deselect();
        });
    }
};

const deselect = (): void => {
    selectedFiles.value = [];
};

const downloadCallback = async (): Promise<void> => {
    try {
        await _downloadFiles(selectedFiles.value);
        Notify.create({
            message: 'Files downloaded successfully',
            color: 'positive',
            timeout: 2000,
            position: 'bottom',
        });
    } catch (error_: unknown) {
        let errorMessage = '';
        if (error_ instanceof Error) {
            errorMessage = error_.message;
        }

        Notify.create({
            message: `Error downloading files: ${errorMessage}`,
            color: 'negative',
            timeout: 2000,
            position: 'bottom',
        });
    }
};

const isDragging = ref(false);

const onDragOver = () => {
    isDragging.value = true;
};

const onDragLeave = (event: DragEvent) => {
    const currentTarget = event.currentTarget as HTMLElement | null;
    const relatedTarget = event.relatedTarget as Node | null;

    if (
        currentTarget &&
        relatedTarget &&
        currentTarget.contains(relatedTarget)
    ) {
        return;
    }

    isDragging.value = false;
};

const onDrop = (event: DragEvent) => {
    isDragging.value = false;
    const dt = event.dataTransfer;
    if (dt?.files && dt.files.length > 0) {
        const droppedFiles = [...dt.files];
        openUploadDialogWithFiles(droppedFiles);
    }
};

const openUploadDialogWithFiles = (files: File[]) => {
    if (!uploads) {
        console.error('Uploads provider is missing.');
        return;
    }

    $q.dialog({
        component: CreateFileDialog,
        componentProps: {
            mission: missionData.value,
            uploads,
            initialFiles: files,
        },
    });
};
</script>

<style scoped>
.button-border:hover {
    border-color: #8d8d8d;
}

:deep(.q-field__control),
:deep(.q-field__marginal) {
    height: 36px !important;
    min-height: 36px !important;
    min-height: 36px !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
}

.mission-files-container {
    position: relative;
    height: 100%;
    min-height: 400px;
}

.drop-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 98, 254, 0.9);
    z-index: 2000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 4px dashed white;
    border-radius: 8px;
    margin: 16px;
}
</style>
