<template>
    <q-card-section>
        <ScopeSelector
            v-model:project-uuid="selectedProjectUuid"
            v-model:mission-uuid="selectedMissionUuid"
            :required="true"
            :disabled="disableScope ?? false"
        />

        <label>Upload File from Device</label>
        <div
            class="drop-zone"
            :class="{ 'drop-active': isDragging }"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="onDrop"
        >
            <div
                v-if="files.length === 0"
                class="column items-center justify-center full-height"
            >
                <q-btn
                    unelevated
                    color="grey-3"
                    text-color="black"
                    label="Add Files"
                    icon-right="sym_o_add"
                    class="q-mb-sm"
                    @click="triggerFileInput"
                />
                <div class="text-grey-5">Accepts .bag or .mcap</div>
            </div>
            <div v-else class="column justify-center q-pa-md full-height">
                <div class="text-h6 q-mb-sm">
                    {{ files.length }} file{{ files.length > 1 ? 's' : '' }}
                    selected
                </div>
                <div class="row q-gutter-sm">
                    <q-chip
                        v-for="(file, index) in files"
                        :key="index"
                        removable
                        @remove="() => removeFile(index)"
                    >
                        {{ file.name }}
                    </q-chip>
                </div>
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

        <br />

        <label>Import File from Google Drive</label>

        <q-input
            v-model="driveUrl"
            outlined
            dense
            clearable
            placeholder="Google Drive Link"
            style="min-width: 300px"
            :rules="driveUrlRules"
        />
    </q-card-section>
</template>

<script setup lang="ts">
import type { FlatMissionDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import type { ProjectDto } from '@kleinkram/api-dto/types/project/base-project.dto';
import type { FileUploadDto } from '@kleinkram/api-dto/types/upload.dto';
import { FileType } from '@kleinkram/shared';
import { isValidGoogleDriveUrl } from '@kleinkram/validation/frontend';
import { useQueryClient } from '@tanstack/vue-query';
import ScopeSelector from 'components/common/scope-selector.vue';
import { useQuasar } from 'quasar';
import { useScopeSelection } from 'src/composables/use-scope-selection';
import { createFileAction, driveUpload } from 'src/services/file-service';
import { computed, Ref, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const emit = defineEmits(['update:ready']);

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

const files = ref<File[]>([...props.initialFiles]);
const driveUrl = ref('');

const driveUrlRules = computed(() => [
    (value: string) =>
        isValidGoogleDriveUrl(value) ||
        'Invalid Google Drive Link (must be a file/folder link or ID)',
]);

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
    return missions.value.find(
        (m) => m.uuid === selectedMissionUuid.value,
    ) as unknown as FlatMissionDto;
});

const acceptedFileTypes = computed(() => {
    return [
        ...Object.values(FileType)
            .filter((type) => type !== FileType.ALL)
            .map((type) => `.${type.toLowerCase()}`),
        '.yml',
    ] // ymal files could have both .yml and .yaml as extension
        .join(',');
});

const ready = computed(() => {
    const hasProject = !!selectedProject.value;
    const hasMission = !!selectedMission.value;
    const hasFileOrDrive = files.value.length > 0 || driveUrl.value !== '';
    return hasProject && hasMission && hasFileOrDrive;
});

watch(
    () => ready.value,
    (value) => {
        emit('update:ready', value);
    },
    { immediate: true },
);

const createFile = async (): Promise<void> => {
    if (!selectedMission.value || !selectedProject.value) return;

    if (driveUrl.value !== '') {
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
        files.value,
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
    // Reset to allow re-selection
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
    const newFiles = [...fileList];
    // Simple validation could be done here if needed
    if (newFiles.length > 0) {
        files.value = [...files.value, ...newFiles];
    }
};

const removeFile = (index: number) => {
    files.value.splice(index, 1);
};
</script>

<style scoped>
.drop-zone {
    border: 2px dashed #e0e0e0;
    border-radius: 4px;
    background-color: #fafafa;
    min-height: 200px;
    transition:
        background-color 0.2s,
        border-color 0.2s;
    margin-bottom: 20px;
    margin-top: 10px;
}

.drop-zone.drop-active {
    background-color: #f0f0f0;
    border-color: #bdbdbd;
}

.full-height {
    height: 100%;
    min-height: 200px;
}
</style>

<style lang="scss">
.q-field__prepend {
    pointer-events: none;
}
</style>
