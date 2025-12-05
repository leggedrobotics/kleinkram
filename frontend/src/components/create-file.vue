<template>
    <q-card-section>
        <ScopeSelector
            v-model:project-uuid="selectedProjectUuid"
            v-model:mission-uuid="selectedMissionUuid"
            :required="true"
            :disabled="disableScope ?? false"
        />

        <label>Upload File from Device</label>
        <q-file
            v-model="files"
            outlined
            multiple
            :accept="acceptedFileTypes"
            style="min-width: 300px"
        >
            <template #prepend>
                <q-icon name="sym_o_attach_file" />
            </template>

            <template #append>
                <q-icon name="sym_o_cancel" @click="resetFiles" />
            </template>
        </q-file>

        <br />

        <label>Import File from Google Drive</label>

        <q-input
            v-model="driveUrl"
            outlined
            dense
            clearable
            placeholder="Google Drive Link"
            style="min-width: 300px"
        />
    </q-card-section>
</template>

<script setup lang="ts">
import type { FlatMissionDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import type { ProjectDto } from '@kleinkram/api-dto/types/project/base-project.dto';
import type { FileUploadDto } from '@kleinkram/api-dto/types/upload.dto';
import { FileType } from '@kleinkram/shared';
import { useQueryClient } from '@tanstack/vue-query';
import ScopeSelector from 'components/common/scope-selector.vue';
import { useScopeSelection } from 'src/composables/use-scope-selection'; // Import Composable
import { createFileAction, driveUpload } from 'src/services/file-service';
import { computed, Ref, ref, watch } from 'vue';

const emit = defineEmits(['update:ready']);

const props = withDefaults(
    defineProps<{
        mission: FlatMissionDto | undefined;
        uploads: Ref<FileUploadDto[]>;
        disableScope?: boolean;
    }>(),
    {
        disableScope: false,
    },
);

const files = ref<File[]>([]);
const driveUrl = ref('');
const uploadingFiles = ref<Record<string, Record<string, string>>>({});
const queryClient = useQueryClient();

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
);

const createFile = async (): Promise<void> => {
    if (!selectedMission.value || !selectedProject.value) return;

    if (driveUrl.value !== '') {
        await driveUpload(selectedMission.value, driveUrl);
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

const resetFiles = (): void => {
    files.value = [];
};
</script>

<style lang="scss">
.q-field__prepend {
    pointer-events: none;
}
</style>
