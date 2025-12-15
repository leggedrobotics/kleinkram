<template>
    <div>
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
            <ButtonGroup>
                <q-select
                    v-model="selectedFileHealth"
                    :options="fileHealthOptions"
                    style="min-width: 160px; height: 36px !important"
                    clearable
                    dense
                    outlined
                    hide-bottom-space
                    class="self-stretch"
                    label="File Health"
                    @clear="clearSelectedFileState"
                >
                    <template #selected-item="props">
                        <q-chip
                            v-if="props.opt"
                            :color="fileHealthColor(props.opt)"
                            :style="`color: ${fileHealthTextColor(props.opt)}; font-size: smaller`"
                        >
                            {{ props.opt }}
                        </q-chip>
                    </template>
                    <template #option="props">
                        <q-item
                            v-ripple
                            clickable
                            v-bind="props.itemProps"
                            dense
                            @click="() => props.toggleOption(props.opt)"
                        >
                            <q-item-section>
                                <div>
                                    <q-chip
                                        dense
                                        :color="fileHealthColor(props.opt)"
                                        :style="`color: ${fileHealthTextColor(props.opt)}`"
                                        class="full-width"
                                    >
                                        {{ props.opt }}
                                    </q-chip>
                                </div>
                            </q-item-section>
                        </q-item>
                    </template>
                </q-select>
                <CategorySelector
                    v-if="projectUuid"
                    :selected="selectedCategories"
                    :project-uuid="projectUuid"
                    class="self-stretch"
                    style="height: 36px !important"
                    @update:selected="updateSelected"
                />

                <div
                    class="button-border"
                    style="min-width: 220px; height: 36px"
                >
                    <file-type-selector v-model="fileTypeFilter" />
                </div>

                <app-search-bar
                    v-model="search"
                    placeholder="Search by Filename"
                />

                <app-refresh-button @click="refresh" />

                <create-file-dialog-opener
                    :mission="mission as MissionWithFilesDto"
                >
                    <app-create-button
                        label="Upload File"
                        icon="sym_o_upload"
                    />
                </create-file-dialog-opener>
            </ButtonGroup>
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
                <template v-if="mission" #end>
                    <klein-download-files
                        :files="selectedFiles"
                        style="max-width: 300px"
                    />
                    <OpenMultCategoryAdd
                        :mission="mission"
                        :files="selectedFiles"
                    />
                    <OpenMultiFileMoveDialog
                        :mission="mission"
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
                    :url-handler="handler"
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
import type { CategoryDto } from '@kleinkram/api-dto/types/category.dto';
import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import type { MissionWithFilesDto } from '@kleinkram/api-dto/types/mission/mission-with-files.dto';
import { FileType, HealthStatus } from '@kleinkram/shared';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import CreateFileDialogOpener from 'components/button-wrapper/dialog-opener-create-file.vue';
import ButtonGroupOverlay from 'components/buttons/button-group-overlay.vue';
import ButtonGroup from 'components/buttons/button-group.vue';
import OpenMultCategoryAdd from 'components/buttons/open-mult-category-add-dialog-button.vue';
import OpenMultiFileMoveDialog from 'components/buttons/open-multi-file-move-dialog-button.vue';
import CategorySelector from 'components/category-selector.vue';
import KleinDownloadFiles from 'components/cli-links/klein-download-files.vue';
import AppCreateButton from 'components/common/app-create-button.vue';
import AppRefreshButton from 'components/common/app-refresh-button.vue';
import AppSearchBar from 'components/common/app-search-bar.vue';
import ExplorerPageFilesTable from 'components/explorer-page/explorer-page-files-table.vue';
import ExplorerPageTableHeader from 'components/explorer-page/explorer-page-table-header.vue';
import FileTypeSelector from 'components/file-type-selector.vue';
import { Notify, useQuasar } from 'quasar';
import ConfirmDeleteDialog from 'src/dialogs/confirm-delete-dialog.vue';
import ConfirmDeleteFileDialog from 'src/dialogs/confirm-delete-file-dialog.vue';
import {
    registerNoPermissionErrorHandler,
    useCategories,
    useHandler,
    useMission,
} from 'src/hooks/query-hooks';
import { useMissionUUID, useProjectUUID } from 'src/hooks/router-hooks';
import { _downloadFiles } from 'src/services/generic';
import { deleteFiles } from 'src/services/mutations/file';
import { FileTypeOption } from 'src/types/file-type-option';
import { computed, Ref, ref, watch } from 'vue';

const queryClient = useQueryClient();
const handler = useHandler();
const $q = useQuasar();

const projectUuid = useProjectUUID();
const missionUuid = useMissionUUID();

const search = computed({
    get: () => handler.value.searchParams.name,
    set: (value: string) => {
        handler.value.setSearch({
            name: value,
            health: selectedFileHealth.value ?? '',
        });
    },
});

const fileTypeFilter = ref<FileTypeOption[] | undefined>(undefined);
const fileHealthOptions = [
    HealthStatus.HEALTHY,
    HealthStatus.UPLOADING,
    HealthStatus.UNHEALTHY,
];

const resetFilter = (): void => {
    fileTypeFilter.value = undefined;
    search.value = '';
    selectedFileHealth.value = undefined;
    selectedCategories.value = [];
};

const selectedFileHealth = computed<string | undefined, string | undefined>({
    get: () => handler.value.searchParams.health,
    set: (value: string | undefined) => {
        handler.value.setSearch({
            health: value ?? '',
            name: search.value ?? '',
        });
    },
});

const selectedFiles: Ref<FileWithTopicDto[]> = ref([]);
watch(
    () => fileTypeFilter.value,
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

const {
    data: mission,
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

// eslint-disable-next-line @typescript-eslint/naming-convention
const { data: all_categories } = useCategories(
    projectUuid.value ?? '',
    ref(''),
);
const allCategories: Ref<CategoryDto[]> = computed(() =>
    all_categories.value ? all_categories.value.data : [],
);

const selectedCategories = computed({
    get: () => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!handler.value.categories) return [];
        return handler.value.categories
            .map((catUUID) =>
                allCategories.value.find((cat) => cat.uuid === catUUID),
            )
            .filter((cat) => cat !== undefined);
    },
    set: (value: CategoryDto[]) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!value) {
            handler.value.setCategories([]);
            return;
        }
        handler.value.setCategories(value.map((cat) => cat.uuid));
    },
});

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
        await queryClient.invalidateQueries({
            predicate: (query) =>
                query.queryKey[0] === 'files' &&
                query.queryKey[1] === missionUuid.value,
        });
        selectedFiles.value = [];
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

async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'files',
    });
}

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

const updateSelected = (value: CategoryDto[]): void => {
    selectedCategories.value = value;
};

const fileHealthColor = (health: HealthStatus): string => {
    switch (health) {
        case HealthStatus.HEALTHY: {
            return 'positive';
        }
        case HealthStatus.UPLOADING: {
            return 'warning';
        }
        case HealthStatus.UNHEALTHY: {
            return 'negative';
        }
        default: {
            return 'grey';
        }
    }
};

const fileHealthTextColor = (health: HealthStatus): string => {
    switch (health) {
        case HealthStatus.HEALTHY: {
            return 'white';
        }
        case HealthStatus.UPLOADING: {
            return 'black';
        }
        case HealthStatus.UNHEALTHY: {
            return 'white';
        }
        default: {
            return 'black';
        }
    }
};

const clearSelectedFileState = (): void => {
    // @ts-ignore
    selectedFileHealth.value = undefined;
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
    padding-top: 0 !important;
    padding-bottom: 0 !important;
}
</style>
