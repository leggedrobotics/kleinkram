<template>
    <q-card-section>
        <label>Project*</label>

        <q-btn-dropdown
            v-model="dropdownNewFileProject"
            :disable="!!props?.mission?.project"
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
            :disable="!!props?.mission"
            :label="selectedMission?.name || 'Mission'"
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
                <q-icon name="sym_o_cancel" @click="files = []" />
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

import { createFileAction, driveUpload } from 'src/services/fileService';
import { MissionDto, MissionsDto } from '@api/types/Mission.dto';
import { ProjectDto } from '@api/types/Project.dto';
import { FileUploadDto } from '@api/types/Upload.dto';
import { useFilteredProjects } from '../hooks/customQueryHooks';

const emit = defineEmits(['update:ready']);

const selectedProject: Ref<ProjectDto | null> = ref(null);

const dropdownNewFileProject = ref(false);
const dropdownNewFileMission = ref(false);
const files = ref<File[]>([]);
const { data: selectedMission } = useFilteredProjects(500, 0, 'name', true);

const data = computed(() => {
    if (_data.value !== undefined) {
        return _data.value.projects;
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

const props = defineProps<{
    mission?: MissionDto;
    uploads: Ref<FileUploadDto[]>;
}>();

if (props.mission?.project) {
    selectedProject.value = props.mission.project;
    selectedMission.value = props.mission;
}

const { data: _missions, refetch } = useQuery<MissionsDto>({
    queryKey: ['missions', selectedProject.value?.uuid],
    queryFn: () => missionsOfProjectMinimal(selectedProject.value?.uuid || ''),
    enabled: !!selectedProject.value?.uuid,
});
const missions = computed(() => {
    if (_missions.value) {
        return _missions.value[0];
    }
    return [];
});

watchEffect(() => {
    if (selectedProject.value?.uuid) {
        refetch().catch(() => {});
    }
});

const createFile = async () => {
    if (driveUrl.value) {
        await driveUpload(selectedMission.value, driveUrl);
        return;
    }

    await createFileAction(
        selectedMission.value,
        selectedProject.value,
        files.value,
        queryClient,
        uploadingFiles,
        props.uploads,
    );
};

defineExpose({
    createFileAction: createFile,
});
</script>

<style lang="scss">
.q-field__prepend {
    pointer-events: none;
}
</style>
<style scoped></style>
