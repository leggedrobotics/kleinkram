<template>
    <base-dialog ref="dialogRef" title="New Mission">
        <template #title> New Mission</template>

        <template #tabs>
            <q-tabs
                v-model="tab_selection"
                dense
                class="text-grey"
                align="left"
                active-color="primary"
            >
                <q-tab
                    name="meta_data"
                    label="Mission Details*"
                    style="color: #222"
                    :disable="missionCreated"
                />
                <q-tab
                    name="tags"
                    :label="
                        'Tags' +
                        (!!project && project.requiredTags.length > 0
                            ? '*'
                            : '')
                    "
                    style="color: #222"
                    :disable="missionCreated"
                />
                <q-tab
                    name="upload"
                    label="Upload Data"
                    style="color: #222"
                    :disable="!missionCreated"
                />
            </q-tabs>
        </template>
        <template #content>
            <q-tab-panels v-model="tab_selection">
                <q-tab-panel name="meta_data" style="min-height: 280px">
                    <label for="projectDescription">Project*</label>
                    <q-btn-dropdown
                        v-model="ddr_open"
                        :disable="!!props?.project_uuid"
                        :label="project?.name || 'Project'"
                        class="q-uploader--bordered full-width full-height q-mb-lg"
                        flat
                        clearable
                        required
                    >
                        <q-list>
                            <q-item
                                v-for="_project in projectsWithCreateWrite"
                                :key="_project.uuid"
                                clickable
                                @click="
                                    () => {
                                        project_uuid = _project.uuid;
                                        ddr_open = false;
                                    }
                                "
                            >
                                <q-item-section>
                                    <q-item-label>
                                        {{ _project.name }}
                                    </q-item-label>
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-btn-dropdown>

                    <label for="missionName">Mission Name *</label>
                    <q-input
                        ref="missionNameInput"
                        v-model="missionName"
                        name="missionName"
                        outlined
                        required
                        autofocus
                        dense
                        placeholder="Name...."
                        style="padding-bottom: 30px"
                        :error="!isValidMissionName"
                        :rules="MISSION_NAME_INPUT_VALIDATION"
                        :error-message="errorMessage"
                        @change="
                            () => {
                                errorMessage = '';
                                isValidMissionName = true;
                            }
                        "
                    >
                        <template #error>
                            {{ errorMessage }}
                        </template>
                        <template v-if="missionName" #append>
                            <q-icon
                                name="sym_o_cancel"
                                class="cursor-pointer"
                                @click.stop.prevent="missionName = ''"
                            />
                        </template>
                    </q-input>
                </q-tab-panel>
                <q-tab-panel name="tags" style="min-height: 280px">
                    <SelectMissionTags
                        :tag-values="tagValues"
                        :project-uuid="project.uuid"
                        @update:tag-values="updateTagValue"
                    />
                </q-tab-panel>
                <q-tab-panel name="upload" style="min-width: 280px">
                    <CreateFile
                        v-if="newMission"
                        ref="createFileRef"
                        :mission="newMission"
                        :uploads="uploads"
                    />
                </q-tab-panel>
            </q-tab-panels>
        </template>

        <template #actions>
            <q-btn
                v-if="tab_selection === 'meta_data'"
                flat
                label="Next"
                :disable="
                    missionName.length < MIN_MISSION_NAME_LENGTH ||
                    missionName.length > MAX_MISSION_NAME_LENGTH
                "
                class="bg-button-primary"
                @click="tab_selection = 'tags'"
            />
            <q-btn
                v-if="tab_selection === 'tags'"
                flat
                label="Create Mission"
                class="bg-button-primary"
                :disable="!allRequiredTagsSet"
                @click="submitNewMission"
            />
            <q-btn
                v-if="tab_selection === 'upload'"
                flat
                label="Upload & Exit"
                class="bg-button-primary"
                @click="uploadEventHandler"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { computed, ref, Ref, watch } from 'vue';
import BaseDialog from './base-dialog.vue';
import { Notify, QInput, useDialogPluginComponent } from 'quasar';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { filteredProjects } from 'src/services/queries/project';
import { createMission } from 'src/services/mutations/mission';
import {
    canCreateMission,
    usePermissionsQuery,
    useProjectQuery,
} from '../hooks/query-hooks';
import { ProjectWithMissionsDto } from '@api/types/project/projectWithMissionsDto';
import { MissionWithFilesDto } from '@api/types/mission.dto';
import { FileUploadDto } from '@api/types/upload.dto';
import SelectMissionTags from '@components/select-mission-tags.vue';
import { ProjectsDto } from '@api/types/project/projects.dto';
import { TagDto } from '@api/types/tags/tags.dto';
import CreateFile from '@components/create-file.vue';

const MIN_MISSION_NAME_LENGTH = 3;
const MAX_MISSION_NAME_LENGTH = 50;
const MISSION_NAME_INPUT_VALIDATION: ((value: string) => boolean | string)[] = [
    (value) => !!value || 'Field is required',
    (value) =>
        value.length >= MIN_MISSION_NAME_LENGTH ||
        `Name must be at least ${MIN_MISSION_NAME_LENGTH.toString()} characters`,
    (value) =>
        value.length <= MAX_MISSION_NAME_LENGTH ||
        `Name must be at most ${MAX_MISSION_NAME_LENGTH.toString()} characters`,
    (value) =>
        /^[\w\-_]+$/g.test(value) ||
        'Name must be alphanumeric and contain only - and _',
];

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const tab_selection = ref('meta_data');
const createFileRef = ref<InstanceType<typeof CreateFile> | null>(null);

const props = defineProps<{
    project_uuid: string | undefined;
    uploads: Ref<FileUploadDto[]>;
}>();

const project_uuid = ref(props.project_uuid);
const newMission: Ref<MissionWithFilesDto | undefined> = ref(undefined);
const queryClient = useQueryClient();

const { data: project, refetch } = useProjectQuery(project_uuid);

// we load the new project if the project_uuid changes
watch(project_uuid, () => refetch());

const missionName = ref('');
const isValidMissionName = ref(true);
const errorMessage = ref('');
const ddr_open = ref(false);

const { data: all_projects } = useQuery<ProjectsDto>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name'),
});
const { data: permissions } = usePermissionsQuery();
const projectsWithCreateWrite = computed(() => {
    if (!all_projects.value) return [];
    return all_projects.value.data.filter((_project: ProjectWithMissionsDto) =>
        canCreateMission(_project.uuid, permissions.value),
    );
});

const tagValues: Ref<Record<string, string>> = ref({});

const allRequiredTagsSet = computed(() => {
    return project.value.requiredTags.every(
        (tag: TagDto) =>
            tagValues.value[tag.uuid] !== undefined &&
            tagValues.value[tag.uuid] !== '',
    );
});

const missionCreated = computed(() => {
    return !!newMission.value;
});

const submitNewMission = async () => {
    if (!project.value) {
        return;
    }
    const resp = await createMission(
        missionName.value,
        project.value.uuid,
        tagValues.value,
    ).catch((error: unknown) => {
        tab_selection.value = 'meta_data';
        isValidMissionName.value = false;
        // @ts-ignore
        errorMessage.value = error.response.data.message[0];
    });

    // exit if the request failed
    if (!resp) return;
    newMission.value = resp;
    // @ts-ignore
    newMission.value.project = project.value;
    const cache = queryClient.getQueryCache();
    const filtered = cache
        .getAll()
        .filter(
            (query) =>
                query.queryKey[0] === 'missions' &&
                query.queryKey[1] === project.value.uuid,
        );
    await Promise.all(
        filtered.map((query) => {
            console.log('Invalidating query', query.queryKey);
            return queryClient.invalidateQueries({
                queryKey: query.queryKey,
            });
        }),
    );
    Notify.create({
        message: `Mission ${missionName.value} created`,
        color: 'positive',
        spinner: false,
        timeout: 4000,
        position: 'bottom',
    });
    missionName.value = '';
    tagValues.value = {};
    tab_selection.value = 'upload';
};

const updateTagValue = (update: Record<string, string>): void => {
    tagValues.value = update;
};

const uploadEventHandler = (): void => {
    // @ts-ignore
    createFileRef.value.createFileAction();
    onDialogOK();
};
</script>
