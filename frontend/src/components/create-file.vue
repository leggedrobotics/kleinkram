<template>
    <q-card-section>
        <label>Project*</label>

        <q-btn-dropdown
            v-model="dropdownNewFileProject"
            :disable="!!properties?.mission?.project"
            :label="selectedProject?.name || 'Project'"
            class="q-uploader--bordered full-width full-height q-mb-lg"
            flat
            clearable
            required
        >
            <q-list>
                <q-item
                    v-for="project in data"
                    :key="project.uuid"
                    clickable
                    @click="
                        () => {
                            selectedProject = project;
                            dropdownNewFileProject = false;
                        }
                    "
                >
                    <q-item-section>
                        <q-item-label>
                            {{ project.name }}
                        </q-item-label>
                    </q-item-section>
                </q-item>
            </q-list>
        </q-btn-dropdown>

        <label>Mission*</label>

        <q-btn-dropdown
            v-model="dropdownNewFileMission"
            :disable="!!properties?.mission"
            :label="selectedMission?.name ?? 'Mission'"
            class="q-uploader--bordered full-width full-height q-mb-lg"
            flat
            clearable
            required
        >
            <q-list>
                <q-item
                    v-for="m in missions"
                    :key="m.uuid"
                    clickable
                    @click="
                        () => {
                            selectedMission = m;
                            dropdownNewFileMission = false;
                        }
                    "
                >
                    <q-item-section>
                        <q-item-label>
                            {{ m.name }}
                        </q-item-label>
                    </q-item-section>
                </q-item>
            </q-list>
        </q-btn-dropdown>

        <label>Upload File from Device</label>
        <q-file
            v-model="files"
            outlined
            multiple
            accept=".bag, .mcap"
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
            placholder="Google Drive Link"
            style="min-width: 300px"
        />
    </q-card-section>
</template>
<script setup lang="ts">
import { computed, Ref, ref, watch, watchEffect } from 'vue';

import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { missionsOfProjectMinimal } from 'src/services/queries/mission';

import { FlatMissionDto, MissionsDto } from '@api/types/mission/mission.dto';
import { ProjectDto } from '@api/types/project/base-project.dto';
import { FileUploadDto } from '@api/types/upload.dto';
import { useFilteredProjects } from 'src/hooks/query-hooks';
import { createFileAction, driveUpload } from 'src/services/file-service';

const emit = defineEmits(['update:ready']);

const selectedProject: Ref<ProjectDto | undefined> = ref(undefined);
const selectedMission: Ref<FlatMissionDto | undefined> = ref(undefined);

const dropdownNewFileProject = ref(false);
const dropdownNewFileMission = ref(false);
const files = ref<File[]>([]);
const { data: filteredProjects } = useFilteredProjects(500, 0, 'name', true);

const data = computed(() => {
    if (filteredProjects.value !== undefined) {
        return filteredProjects.value.data;
    }
    return [];
});
const queryClient = useQueryClient();

const driveUrl = ref('');
const uploadingFiles = ref<Record<string, Record<string, string>>>({});

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

const properties = defineProps<{
    mission: FlatMissionDto | undefined;
    uploads: Ref<FileUploadDto[]>;
}>();

if (properties.mission?.project) {
    selectedProject.value = properties.mission.project;
    selectedMission.value = properties.mission;
}

const { data: _missions, refetch } = useQuery<MissionsDto>({
    queryKey: ['missions', selectedProject.value?.uuid],
    queryFn: () => missionsOfProjectMinimal(selectedProject.value?.uuid ?? ''),
    enabled: !(selectedProject.value?.uuid === ''),
});
const missions = computed(() => {
    if (_missions.value) {
        return _missions.value.data;
    }
    return [];
});

watchEffect(() => {
    if (selectedProject.value?.uuid !== '') {
        refetch().catch(() => {
            // Do nothing
        });
    }
});

const createFile = async (): Promise<void> => {
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
        properties.uploads,
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
<style scoped></style>
