<template>
    <q-card-section>
        <label>Project*</label>

        <q-btn-dropdown
            v-model="dropdownNewFileProject"
            :disable="!!props?.mission?.project"
            :label="selected_project?.name || 'Project'"
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
                        selected_project = project;
                        dropdownNewFileProject = false;
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
            :label="selected_mission?.name || 'Mission'"
            class="q-uploader--bordered full-width full-height q-mb-lg"
            flat
            clearable
            required
        >
            <q-list>
                <q-item
                    v-for="mission in missions"
                    :key="mission.uuid"
                    clickable
                    @click="
                        selected_mission = mission;
                        dropdownNewFileMission = false;
                    "
                >
                    <q-item-section>
                        <q-item-label>
                            {{ mission.name }}
                        </q-item-label>
                    </q-item-section>
                </q-item>
            </q-list>
        </q-btn-dropdown>

        <label>Upload File from Device</label>
        <q-file
            outlined
            v-model="files"
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
            v-model="drive_url"
            outlined
            dense
            clearable
            placholder="Google Drive Link"
            style="min-width: 300px"
        />
    </q-card-section>
</template>
<style lang="scss">
.q-field__prepend {
    pointer-events: none;
}
</style>

<script setup lang="ts">
import { computed, onMounted, Ref, ref, watch, watchEffect } from 'vue';

import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { Project } from 'src/types/Project';
import { Mission } from 'src/types/Mission';
import { filteredProjects } from 'src/services/queries/project';
import { missionsOfProject } from 'src/services/queries/mission';

import { FileUpload } from 'src/types/FileUpload';
import { createFileAction, getOnMount } from 'src/services/fileService';

const emit = defineEmits(['update:ready']);

const selected_project: Ref<Project | null> = ref(null);

const dropdownNewFileProject = ref(false);
const dropdownNewFileMission = ref(false);
const files = ref<File[]>([]);
const selected_mission: Ref<Mission | null> = ref(null);
const { data: _data, error } = useQuery<[Project[], number]>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name'),
});
const data = computed(() => {
    if (_data && _data.value) {
        return _data.value[0];
    }
    return [];
});
const queryClient = useQueryClient();

const drive_url = ref('');
const uploadingFiles = ref<Record<string, Record<string, string>>>([]);

const ready = computed(() => {
    const hasProject = !!selected_project.value;
    const hasMission = !!selected_mission.value;
    const hasFileOrDrive = files.value.length > 0 || drive_url.value;
    return hasProject && hasMission && hasFileOrDrive;
});

watch(
    () => ready.value,
    (value) => {
        emit('update:ready', value);
    },
);

const props = defineProps<{
    mission?: Mission;
    uploads: Ref<FileUpload[]>;
}>();

if (props.mission && props.mission.project) {
    selected_project.value = props.mission.project;
    selected_mission.value = props.mission;
}

const { data: _missions, refetch } = useQuery<[Mission[], number]>({
    queryKey: ['missions', selected_project.value?.uuid],
    queryFn: () => missionsOfProject(selected_project.value?.uuid || ''),
    enabled: !!selected_project.value?.uuid,
});
const missions = computed(() => {
    if (_missions && _missions.value) {
        return _missions.value[0];
    }
    return [];
});

watchEffect(() => {
    if (selected_project.value?.uuid) {
        refetch();
    }
});

const createFile = async () => {
    return await createFileAction(
        selected_mission.value,
        selected_project.value,
        files.value,
        queryClient,
        uploadingFiles,
        props.uploads,
    );
};
onMounted(getOnMount(uploadingFiles, selected_mission));

defineExpose({
    createFileAction: createFile,
});
</script>
<style scoped></style>
