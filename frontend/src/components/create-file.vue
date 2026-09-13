<template>
    <q-card-section>
        <ScopeSelector
            v-model:project-uuid="selectedProjectUuid"
            v-model:mission-uuid="selectedMissionUuid"
            :required="true"
            :disabled="disableScope ?? false"
        />

        <label>Upload Files from Device</label>
        <div
            class="drop-zone"
            :class="{
                'drop-active': isDragging,
                'drop-compact': entries.length > 0,
            }"
            role="button"
            tabindex="0"
            :aria-label="dropZoneLabel"
            @click="triggerFileInput"
            @keydown.enter.prevent="triggerFileInput"
            @keydown.space.prevent="triggerFileInput"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="onDrop"
        >
            <div class="drop-zone-icon">
                <q-icon name="sym_o_upload_file" size="28px" />
            </div>
            <div class="text-body1 text-grey-9">
                {{ dropZoneLabel }}
            </div>
            <div class="text-caption text-grey-6">
                Accepts {{ acceptedExtensionsLabel }} · max
                {{ MAX_FILE_SIZE_LABEL }} per file
            </div>
        </div>

        <input
            ref="fileInputReference"
            type="file"
            multiple
            style="display: none"
            :accept="acceptedFileTypes"
            @change="handleFileChange"
        />

        <div v-if="entries.length > 0" class="q-mt-md">
            <div class="row items-center justify-between q-mb-sm">
                <div class="text-caption text-grey-7">
                    {{ entries.length }} file{{
                        entries.length === 1 ? '' : 's'
                    }}
                    · {{ formatSize(totalSize) }}
                    <span v-if="invalidCount > 0" class="text-negative">
                        · {{ invalidCount }} need{{
                            invalidCount === 1 ? 's' : ''
                        }}
                        attention
                    </span>
                </div>
                <q-btn
                    flat
                    dense
                    no-caps
                    size="sm"
                    color="grey-8"
                    label="Remove all"
                    @click="removeAllFiles"
                />
            </div>

            <div class="column q-gutter-y-sm">
                <div
                    v-for="entry in entries"
                    :key="entry.id"
                    class="file-card"
                    :class="{ 'file-card-error': entry.errors.length > 0 }"
                >
                    <div class="file-card-icon">
                        <q-icon :name="fileIcon(entry.extension)" size="22px" />
                    </div>

                    <div class="col file-card-body">
                        <template v-if="entry.editing">
                            <q-input
                                :model-value="entry.namePart"
                                dense
                                outlined
                                autofocus
                                :suffix="entry.extension"
                                :error="entry.errors.length > 0"
                                :error-message="entry.errors[0]"
                                :hint="`${entry.fullName.length} / ${FILENAME_MAX_LENGTH} characters`"
                                hide-bottom-space
                                @update:model-value="
                                    (value) => setNamePart(entry.id, value)
                                "
                                @keydown.enter.prevent="
                                    () => finishEditing(entry)
                                "
                                @keydown.esc.prevent="
                                    () => finishEditing(entry)
                                "
                            >
                                <template #append>
                                    <q-btn
                                        flat
                                        dense
                                        round
                                        size="sm"
                                        icon="sym_o_check"
                                        :disable="entry.errors.length > 0"
                                        @click="() => finishEditing(entry)"
                                    >
                                        <q-tooltip>Done</q-tooltip>
                                    </q-btn>
                                </template>
                            </q-input>
                        </template>
                        <template v-else>
                            <div class="row items-center no-wrap">
                                <span class="text-body2 ellipsis">
                                    {{ entry.fullName }}
                                </span>
                                <q-icon
                                    v-if="entry.renamed"
                                    name="sym_o_edit"
                                    size="14px"
                                    class="q-ml-xs text-grey-6"
                                >
                                    <q-tooltip>
                                        Renamed from {{ entry.file.name }}
                                    </q-tooltip>
                                </q-icon>
                            </div>
                            <div class="text-caption text-grey-6">
                                {{ formatSize(entry.file.size) }}
                            </div>
                            <div
                                v-if="entry.errors.length > 0"
                                class="text-caption text-negative"
                            >
                                {{ entry.errors[0] }}
                            </div>
                        </template>
                    </div>

                    <div class="row no-wrap items-center q-gutter-x-xs">
                        <q-btn
                            v-if="!entry.editing && entry.canRename"
                            flat
                            dense
                            round
                            size="sm"
                            icon="sym_o_edit"
                            color="grey-8"
                            @click="() => startEditing(entry)"
                        >
                            <q-tooltip>Rename</q-tooltip>
                        </q-btn>
                        <q-btn
                            flat
                            dense
                            round
                            size="sm"
                            icon="sym_o_delete"
                            color="grey-8"
                            @click="() => removeFile(entry.id)"
                        >
                            <q-tooltip>Remove</q-tooltip>
                        </q-btn>
                    </div>
                </div>
            </div>
        </div>

        <div class="row items-center q-my-md text-grey-6 text-caption">
            <q-separator class="col" />
            <span class="q-px-sm">or</span>
            <q-separator class="col" />
        </div>

        <label>Import File from Google Drive</label>

        <q-input
            v-model="driveUrl"
            outlined
            dense
            clearable
            placeholder="Google Drive Link"
            :rules="driveUrlRules"
            :disable="entries.length > 0"
            :hint="
                entries.length > 0
                    ? 'Remove the selected files to import from Google Drive instead'
                    : ''
            "
        />
    </q-card-section>
</template>

<script setup lang="ts">
import type { FlatMissionDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import type { ProjectDto } from '@kleinkram/api-dto/types/project/base-project.dto';
import type { FileUploadDto } from '@kleinkram/api-dto/types/upload.dto';
import { FileType } from '@kleinkram/shared';
import {
    FILENAME_MAX_LENGTH,
    isValidFileName,
    isValidFileNamePart,
    isValidGoogleDriveUrl,
    NON_UUID_REGEX,
    splitFileName,
} from '@kleinkram/validation/frontend';
import { useQueryClient } from '@tanstack/vue-query';
import ScopeSelector from 'components/common/scope-selector.vue';
import { useQuasar } from 'quasar';
import { useScopeSelection } from 'src/composables/use-scope-selection';
import { createFileAction, driveUpload } from 'src/services/file-service';
import { formatSize } from 'src/services/general-formatting';
import { computed, Ref, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const emit = defineEmits(['update:ready', 'update:hasErrors']);

const props = withDefaults(
    defineProps<{
        mission: FlatMissionDto | undefined;
        uploads: Ref<FileUploadDto[]>;
        disableScope?: boolean;
        initialFiles?: File[];
    }>(),
    {
        disableScope: false,
        initialFiles: () => [],
    },
);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = '50 GB';

const acceptedExtensions = [
    ...Object.values(FileType)
        .filter((type) => type !== FileType.ALL)
        .map((type) => `.${type.toLowerCase()}`),
    '.yml', // yaml files can have both .yml and .yaml as extension
];
const acceptedExtensionSet = new Set(acceptedExtensions);
const acceptedFileTypes = acceptedExtensions.join(',');
const acceptedExtensionsLabel = acceptedExtensions.join(', ');

interface FileEntry {
    id: number;
    file: File;
    namePart: string;
    extension: string;
    editing: boolean;
}

interface FileEntryView extends FileEntry {
    fullName: string;
    errors: string[];
    canRename: boolean;
    renamed: boolean;
}

let nextEntryId = 0;
const toEntry = (file: File): FileEntry => {
    const { name, extension } = splitFileName(file.name);
    return {
        id: nextEntryId++,
        file,
        namePart: name,
        extension,
        editing: false,
    };
};

const rawEntries = ref<FileEntry[]>(
    props.initialFiles.map((file) => toEntry(file)),
);
const driveUrl = ref('');

const driveUrlRules = computed(() => [
    (value: string) =>
        isValidGoogleDriveUrl(value) ||
        'Invalid Google Drive Link (must be a file/folder link or ID)',
]);

const hasValidExtension = (extension: string): boolean =>
    acceptedExtensionSet.has(extension.toLowerCase());

const nameErrors = (entry: FileEntry, fullName: string): string[] => {
    const errors: string[] = [];
    if (entry.namePart.trim().length === 0) {
        errors.push('File name must not be empty');
    } else if (fullName.length > FILENAME_MAX_LENGTH) {
        errors.push(
            `File name is too long (${String(fullName.length)} of ${String(FILENAME_MAX_LENGTH)} characters)`,
        );
    } else if (!isValidFileNamePart(entry.namePart)) {
        errors.push(
            'Only letters, digits, underscores, hyphens, dots and brackets are allowed',
        );
    } else if (entry.namePart.length < 3) {
        errors.push('File name must have at least 3 characters');
    } else if (!isValidFileName(fullName)) {
        errors.push('File name contains characters that are not accepted');
    } else if (!NON_UUID_REGEX.test(fullName)) {
        errors.push('File name must not be a UUID');
    }
    return errors;
};

const entries = computed<FileEntryView[]>(() => {
    const nameCounts = new Map<string, number>();
    for (const entry of rawEntries.value) {
        const fullName = entry.namePart + entry.extension;
        nameCounts.set(fullName, (nameCounts.get(fullName) ?? 0) + 1);
    }

    return rawEntries.value.map((entry) => {
        const fullName = entry.namePart + entry.extension;
        const canRename = hasValidExtension(entry.extension);
        const errors: string[] = [];

        if (!canRename) {
            errors.push(
                `Unsupported file type. Accepted: ${acceptedExtensionsLabel}`,
            );
        } else if (entry.file.size === 0) {
            errors.push('File is empty');
        } else if (entry.file.size > MAX_FILE_SIZE_BYTES) {
            errors.push(
                `File is larger than ${MAX_FILE_SIZE_LABEL}. Please use the CLI to upload it.`,
            );
        } else {
            errors.push(...nameErrors(entry, fullName));
            if ((nameCounts.get(fullName) ?? 0) > 1) {
                errors.push('Another selected file has the same name');
            }
        }

        return {
            ...entry,
            fullName,
            errors,
            canRename,
            renamed: fullName !== entry.file.name,
        };
    });
});

const totalSize = computed(() =>
    rawEntries.value.reduce((sum, entry) => sum + entry.file.size, 0),
);
const invalidCount = computed(
    () => entries.value.filter((entry) => entry.errors.length > 0).length,
);

const dropZoneLabel = computed(() =>
    entries.value.length > 0
        ? 'Click to add more files or drag and drop'
        : 'Click to upload or drag and drop',
);

const fileIcon = (extension: string): string => {
    switch (extension.toLowerCase()) {
        case '.bag':
        case '.mcap': {
            return 'sym_o_database';
        }
        case '.yaml':
        case '.yml': {
            return 'sym_o_data_object';
        }
        default: {
            return 'sym_o_draft';
        }
    }
};

const uploadingFiles = ref<Record<string, Record<string, string>>>({});
const queryClient = useQueryClient();
const router = useRouter();
const quasar = useQuasar();

const selectedProjectUuid = ref<string | undefined>(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    props.mission?.project?.uuid,
);
const selectedMissionUuid = ref<string | undefined>(props.mission?.uuid);

const { projects, missions } = useScopeSelection(
    selectedProjectUuid,
    selectedMissionUuid,
);

const selectedProject = computed((): ProjectDto | undefined => {
    if (props.mission?.project) return props.mission.project;
    return projects.value.find((p) => p.uuid === selectedProjectUuid.value);
});

const selectedMission = computed((): FlatMissionDto | undefined => {
    if (props.mission) return props.mission;
    return missions.value.find((m) => m.uuid === selectedMissionUuid.value);
});

const ready = computed(() => {
    const hasProject = !!selectedProject.value;
    const hasMission = !!selectedMission.value;
    const hasFiles = entries.value.length > 0;
    const filesValid = hasFiles && invalidCount.value === 0;
    const hasDrive =
        !hasFiles &&
        driveUrl.value !== '' &&
        isValidGoogleDriveUrl(driveUrl.value);
    return hasProject && hasMission && (filesValid || hasDrive);
});

watch(
    () => ready.value,
    (value) => {
        emit('update:ready', value);
    },
    { immediate: true },
);

const hasErrors = computed(
    () =>
        invalidCount.value > 0 ||
        (driveUrl.value !== '' && !isValidGoogleDriveUrl(driveUrl.value)),
);

watch(
    () => hasErrors.value,
    (value) => {
        emit('update:hasErrors', value);
    },
    { immediate: true },
);

const filesToUpload = (): File[] =>
    entries.value.map((entry) =>
        entry.renamed
            ? new File([entry.file], entry.fullName, {
                  type: entry.file.type,
                  lastModified: entry.file.lastModified,
              })
            : entry.file,
    );

const createFile = async (): Promise<void> => {
    if (!selectedMission.value || !selectedProject.value) return;
    if (!ready.value) {
        if (invalidCount.value > 0) {
            quasar.notify({
                message:
                    'Some selected files are invalid. Please fix or remove them before uploading.',
                color: 'negative',
                timeout: 4000,
            });
        }
        return;
    }

    if (entries.value.length === 0 && driveUrl.value !== '') {
        const success = await driveUpload(selectedMission.value, driveUrl);
        if (success) {
            quasar.notify({
                message:
                    'Google Drive upload started. check the progress in the Upload page.',
                color: 'positive',
                timeout: 0,
                actions: [
                    {
                        label: 'Go to Uploads',
                        color: 'white',
                        handler: () => {
                            void router.push('/upload');
                        },
                    },
                    {
                        label: 'Dismiss',
                        color: 'white',
                        handler: () => {
                            /* dismiss */
                        },
                    },
                ],
            });
        }
        return;
    }

    await createFileAction(
        selectedMission.value,
        selectedProject.value,
        filesToUpload(),
        queryClient,
        uploadingFiles,
        // @ts-ignore
        props.uploads,
    );
};

defineExpose({
    createFileAction: createFile,
});

const isDragging = ref(false);
const fileInputReference = ref<HTMLInputElement>();

const triggerFileInput = () => {
    fileInputReference.value?.click();
};

const handleFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files) {
        addFiles(target.files);
    }
    // Reset to allow re-selection of the same file
    target.value = '';
};

const onDragOver = () => {
    isDragging.value = true;
};

const onDragLeave = () => {
    isDragging.value = false;
};

const onDrop = (event: DragEvent) => {
    isDragging.value = false;
    const dt = event.dataTransfer;
    if (dt?.files) {
        addFiles(dt.files);
    }
};

const addFiles = (fileList: FileList) => {
    const known = new Set(
        rawEntries.value.map(
            (entry) =>
                `${entry.file.name}:${String(entry.file.size)}:${String(entry.file.lastModified)}`,
        ),
    );
    const newEntries: FileEntry[] = [];
    let skipped = 0;
    for (const file of fileList) {
        const key = `${file.name}:${String(file.size)}:${String(file.lastModified)}`;
        if (known.has(key)) {
            skipped++;
            continue;
        }
        known.add(key);
        newEntries.push(toEntry(file));
    }
    rawEntries.value = [...rawEntries.value, ...newEntries];
    if (skipped > 0) {
        quasar.notify({
            message: `${String(skipped)} file${skipped === 1 ? ' was' : 's were'} already selected and ${skipped === 1 ? 'was' : 'were'} skipped.`,
            color: 'warning',
            timeout: 3000,
        });
    }
};

const removeFile = (id: number) => {
    rawEntries.value = rawEntries.value.filter((entry) => entry.id !== id);
};

const removeAllFiles = () => {
    rawEntries.value = [];
};

const findRawEntry = (id: number): FileEntry | undefined =>
    rawEntries.value.find((entry) => entry.id === id);

const setNamePart = (id: number, value: string | number | null) => {
    const raw = findRawEntry(id);
    if (raw) raw.namePart = value === null ? '' : String(value);
};

const startEditing = (entry: FileEntryView) => {
    const raw = findRawEntry(entry.id);
    if (raw) raw.editing = true;
};

const finishEditing = (entry: FileEntryView) => {
    const raw = findRawEntry(entry.id);
    if (!raw) return;
    raw.namePart = raw.namePart.trim();
    raw.editing = false;
};

// Open the name editor automatically for files whose name must be changed
watch(
    entries,
    (current) => {
        for (const entry of current) {
            if (entry.editing || entry.errors.length === 0) continue;
            if (!entry.canRename) continue;
            const raw = findRawEntry(entry.id);
            if (raw && !raw.editing) raw.editing = true;
        }
    },
    { immediate: true },
);
</script>

<style scoped>
.drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 2px dashed #e0e0e0;
    border-radius: 8px;
    background-color: #fafafa;
    min-height: 180px;
    padding: 24px;
    margin-top: 10px;
    cursor: pointer;
    text-align: center;
    transition:
        background-color 0.2s,
        border-color 0.2s,
        min-height 0.2s;
}

.drop-zone:hover,
.drop-zone:focus-visible {
    background-color: #f3f3f3;
    border-color: #bdbdbd;
    outline: none;
}

.drop-zone.drop-active {
    background-color: #e8f0fe;
    border-color: #1976d2;
}

.drop-zone.drop-compact {
    min-height: 120px;
    padding: 16px;
}

.drop-zone-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background-color: #ffffff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    color: #1976d2;
    margin-bottom: 8px;
}

.file-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background-color: #ffffff;
}

.file-card-error {
    border-color: #f2b8b5;
    background-color: #fff8f7;
}

.file-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: #f5f5f5;
    color: #616161;
}

.file-card-body {
    min-width: 0;
}
</style>

<style lang="scss">
.q-field__prepend {
    pointer-events: none;
}
</style>
