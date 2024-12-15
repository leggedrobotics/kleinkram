<template>
    <title-section :title="mission?.name">
        <template #subtitle>
            <div>
                <div class="flex justify-between items-center">
                    <div>
                        <div class="flex">
                            <span
                                v-for="tag in mission?.tags ?? ([] as TagDto[])"
                                :key="tag.uuid"
                                class="q-mr-xs"
                            >
                                <q-chip
                                    square
                                    :style="[
                                        tag.type.datatype == 'LINK'
                                            ? { cursor: 'pointer' }
                                            : {},
                                    ]"
                                    color="gray"
                                    @mouseup="() => openLink(tag)"
                                >
                                    {{ tag.type.name }}:
                                    {{ tag.value }}
                                </q-chip>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <template #buttons>
            <button-group>
                <q-btn
                    class="button-border"
                    flat
                    color="primary"
                    icon="sym_o_analytics"
                    label="Actions"
                    @click="onActionsClick"
                >
                    <q-tooltip> Analyze Actions</q-tooltip>
                </q-btn>

                <MissionMetadataOpener v-if="mission" :mission="mission">
                    <q-btn
                        class="button-border"
                        flat
                        color="primary"
                        icon="sym_o_sell"
                        label="Metadata"
                    >
                        <q-tooltip> Manage Metadata Tags</q-tooltip>
                    </q-btn>
                </MissionMetadataOpener>

                <q-btn icon="sym_o_more_vert" class="button-border" flat>
                    <q-tooltip> More Actions</q-tooltip>

                    <q-menu v-if="mission" auto-close style="width: 320px">
                        <q-list>
                            <klein-download-mission
                                v-if="mission"
                                :mission="mission"
                            />
                            <q-separator class="q-ma-sm" />
                            <MoveMissionDialogOpener
                                v-if="mission"
                                :mission="mission"
                            >
                                <q-item v-close-popup clickable>
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_move_down" />
                                    </q-item-section>
                                    <q-item-section>
                                        Move Mission
                                    </q-item-section>
                                </q-item>
                            </MoveMissionDialogOpener>

                            <q-item v-close-popup clickable disable>
                                <q-item-section avatar>
                                    <q-icon name="sym_o_lock" />
                                </q-item-section>
                                <q-item-section>
                                    <q-item-section>
                                        Manage Access
                                    </q-item-section>
                                </q-item-section>
                                <q-tooltip>
                                    Manage Access on Mission Level is not
                                    supported yet
                                </q-tooltip>
                            </q-item>

                            <EditMissionDialogOpener
                                v-if="mission"
                                :mission="mission"
                            >
                                <q-item v-close-popup clickable>
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_edit" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-section>
                                            Edit Mission
                                        </q-item-section>
                                    </q-item-section>
                                </q-item>
                            </EditMissionDialogOpener>

                            <delete-mission-dialog-opener
                                v-if="mission"
                                :mission="mission"
                            >
                                <q-item
                                    v-close-popup
                                    clickable
                                    style="color: red"
                                >
                                    <q-item-section avatar>
                                        <q-icon name="sym_o_delete" />
                                    </q-item-section>
                                    <q-item-section>
                                        <q-item-section>
                                            Delete Mission
                                        </q-item-section>
                                    </q-item-section>
                                </q-item>
                            </delete-mission-dialog-opener>
                        </q-list>
                    </q-menu>
                </q-btn>
            </button-group>
        </template>
    </title-section>

    <div>
        <div
            v-if="selectedFiles.length === 0"
            class="q-my-lg flex justify-between items-center"
        >
            <Suspense>
                <ExplorerPageTableHeader
                    v-if="handler"
                    :url_handler="handler"
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
                    dense
                    clearable
                    :options="fileHealthOptions"
                    style="min-width: 120px"
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
                    :project_uuid="projectUuid"
                    @update:selected="updateSelected"
                />
                <q-btn-dropdown
                    clearable
                    dense
                    class="button-border"
                    flat
                    style="min-width: 220px"
                    :label="'File Types: ' + selectedFileTypes"
                >
                    <q-list style="width: 100%">
                        <q-item
                            v-for="(option, index) in fileTypeFilter"
                            :key="index"
                        >
                            <q-item-section class="items-baseline">
                                <q-toggle
                                    :model-value="fileTypeFilter[index].value"
                                    :label="option.name"
                                    @click="() => onFileTypeClicked(index)"
                                />
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
                <q-input
                    v-model="search"
                    debounce="300"
                    placeholder="Search"
                    dense
                    outlined
                >
                    <template #append>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>

                <q-btn
                    flat
                    dense
                    padding="6px"
                    color="icon-secondary"
                    class="button-border"
                    icon="sym_o_loop"
                    @click="refresh"
                >
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>

                <create-file-dialog-opener :mission="mission">
                    <q-btn
                        flat
                        style="height: 100%"
                        class="bg-button-secondary text-on-color"
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
import {
    registerNoPermissionErrorHandler,
    useCategories,
    useHandler,
    useMission,
} from '../hooks/query-hooks';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import ROUTES from 'src/router/routes';
import { Notify, useQuasar } from 'quasar';
import { computed, Ref, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { deleteFiles } from 'src/services/mutations/file';
import ConfirmDeleteDialog from '../dialogs/confirm-delete-dialog.vue';
import { _downloadFiles } from 'src/services/generic';
import { DataType, FileType } from '@common/enum';
import { TagDto } from '@api/types/tags/tags.dto';
import { CategoryDto } from '@api/types/category.dto';

import { FileWithTopicDto } from '@api/types/files/file.dto';
import { useMissionUUID, useProjectUUID } from '../hooks/router-hooks';
import ButtonGroup from '@components/buttons/button-group.vue';
import MissionMetadataOpener from '../components/button-wrapper/MissionMetadataOpener.vue';
import KleinDownloadMission from '@components/cli-links/klein-download-mission.vue';
import EditMissionDialogOpener from '../components/button-wrapper/EditMissionDialogOpener.vue';
import DeleteMissionDialogOpener from '../components/button-wrapper/DeleteMissionDialogOpener.vue';
import CategorySelector from '../components/CategorySelector.vue';
import CreateFileDialogOpener from '@components/button-wrapper/dialog-opener-create-file.vue';
import ButtonGroupOverlay from '@components/buttons/button-group-overlay.vue';
import KleinDownloadFiles from '@components/cli-links/klein-download-files.vue';
import ExplorerPageFilesTable from '@components/explorer-page/explorer-page-files-table.vue';
import TitleSection from '@components/title-section.vue';
import ConfirmDeleteFileDialog from '../dialogs/confirm-delete-file-dialog.vue';
import MoveMissionDialogOpener from '../components/button-wrapper/MoveMissionDialogOpener.vue';
import ExplorerPageTableHeader from '@components/explorer-page/explorer-page-table-header.vue';
import OpenMultiFileMoveDialog from '@components/buttons/open-multi-file-move-dialog-button.vue';
import OpenMultCategoryAdd from '@components/buttons/open-mult-category-add-dialog-button.vue';

const queryClient = useQueryClient();
const handler = useHandler();
const $q = useQuasar();
const $router = useRouter();

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
const fileTypeFilter = ref([
    { name: 'Bag', value: true },
    { name: 'MCAP', value: true },
]);
const selectedFileTypes = computed(() => {
    return fileTypeFilter.value
        .filter((item) => item.value)
        .map((item) => item.name)
        .join(' & ');
});
const fileHealthOptions = ['Healthy', 'Uploading', 'Unhealthy'];

const selectedFileHealth = computed<string, string | undefined>({
    get: () => handler.value.searchParams.health,
    set: (value: string | undefined) => {
        handler.value.setSearch({ health: value ?? '', name: search.value });
    },
});

const selectedFiles: Ref<FileWithTopicDto[]> = ref([]);
watch(
    () => fileTypeFilter.value,
    () => {
        if (fileTypeFilter.value[0].value && fileTypeFilter.value[1].value) {
            handler.value.setFileType(FileType.ALL);
            return;
        }
        handler.value.setFileType(
            fileTypeFilter.value[0].value ? FileType.BAG : FileType.MCAP,
        );
    },
    { deep: true },
);

const onFileTypeClicked = (index: number): void => {
    const updatedFileTypeFilter = [...fileTypeFilter.value]; // Only trigger a single mutation
    updatedFileTypeFilter[index].value = !updatedFileTypeFilter[index].value;
    if (!updatedFileTypeFilter[0].value && !updatedFileTypeFilter[1].value) {
        updatedFileTypeFilter[1 - index].value = true;
    }
    fileTypeFilter.value = updatedFileTypeFilter;
};

const {
    data: mission,
    isLoadingError,
    error,
} = useMission(
    missionUuid.value ?? '',
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
registerNoPermissionErrorHandler(isLoadingError, missionUuid, 'mission', error);

const { data: all_categories } = useCategories(projectUuid.value ?? '', '');
const allCategories: Ref<CategoryDto[]> = computed(() =>
    all_categories.value ? all_categories.value.data : [],
);

const selectedCategories = computed({
    get: () => {
        if (!handler.value.categories) return [];
        return handler.value.categories
            .map((catUUID) =>
                allCategories.value.find((cat) => cat.uuid === catUUID),
            )
            .filter((cat) => cat !== undefined);
    },
    set: (value: CategoryDto[]) => {
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

async function refresh() {
    await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'files',
    });
}

const openLink = (tag: TagDto): void => {
    if (tag.type.datatype !== DataType.LINK) return;
    window.open(tag.valueAsString, '_blank');
};

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

const fileHealthColor = (health: string): string => {
    switch (health) {
        case 'Healthy': {
            return 'positive';
        }
        case 'Uploading': {
            return 'warning';
        }
        case 'Unhealthy': {
            return 'negative';
        }
        default: {
            return 'grey';
        }
    }
};

const fileHealthTextColor = (health: string): string => {
    switch (health) {
        case 'Healthy': {
            return 'white';
        }
        case 'Uploading': {
            return 'black';
        }
        case 'Unhealthy': {
            return 'white';
        }
        default: {
            return 'black';
        }
    }
};

const onActionsClick = async (): Promise<void> => {
    await $router.push({
        name: ROUTES.ACTION.routeName,
        query: {
            project_uuid: projectUuid.value ?? '',
            mission_uuid: missionUuid.value ?? '',
        },
    });
};

const clearSelectedFileState = (): void => {
    selectedFileHealth.value = undefined;
};
</script>
