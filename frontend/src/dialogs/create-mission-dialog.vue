<template>
    <base-dialog ref="dialogRef" title="New Mission">
        <template #title> New Mission </template>

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
                        'Metadata' +
                        (!!project && project.requiredTags.length > 0
                            ? '*'
                            : '')
                    "
                    style="color: #222"
                    :disable="!project || missionCreated"
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
                    <div
                        v-if="
                            !projectsWithCreateWrite ||
                            projectsWithCreateWrite.length === 0
                        "
                        class="text-grey"
                    >
                        <q-icon name="sym_o_info" size="sm" class="q-mr-sm" />
                        You do not have permission to create missions, or no
                        projects exist yet.
                    </div>
                    <div v-else>
                        <ScopeSelector
                            v-model:project-uuid="projectUuid"
                            :custom-projects="projectsWithCreateWrite"
                            :show-mission="false"
                            :required="true"
                            class="q-mb-md"
                        />

                        <template v-if="projectUuid">
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
                                @change="onMissionNameChange"
                            >
                                <template #error>
                                    {{ errorMessage }}
                                </template>
                                <template v-if="missionName" #append>
                                    <q-icon
                                        name="sym_o_cancel"
                                        class="cursor-pointer"
                                        @click.stop.prevent="clearMissionName"
                                    />
                                </template>
                            </q-input>
                        </template>
                        <div v-else class="text-grey">
                            Please select a project to create a mission.
                        </div>
                    </div>
                </q-tab-panel>
                <q-tab-panel name="tags" style="min-height: 280px">
                    <SelectMissionTags
                        v-if="project"
                        :tag-values="tagValues"
                        :project-uuid="project.uuid"
                        @update:tag-values="updateTagValue"
                    />
                </q-tab-panel>
                <q-tab-panel name="upload" style="min-width: 280px">
                    <CreateFile
                        v-if="newMission"
                        ref="createFileReference"
                        :mission="newMission"
                        :uploads="uploads"
                        :disable-scope="true"
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
                    !project ||
                    missionName.length < MIN_MISSION_NAME_LENGTH ||
                    missionName.length > MAX_MISSION_NAME_LENGTH
                "
                class="bg-button-primary"
                @click="navigateToMetadataTab"
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
import { FlatMissionDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import { ProjectsDto } from '@kleinkram/api-dto/types/project/projects.dto';
import { FileUploadDto } from '@kleinkram/api-dto/types/upload.dto';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import ScopeSelector from 'components/common/scope-selector.vue';
import CreateFile from 'components/create-file.vue';
import SelectMissionTags from 'components/select-mission-tags.vue';
import { Notify, useDialogPluginComponent } from 'quasar';
import { useScopeSelection } from 'src/composables/use-scope-selection';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { canCreateMission, usePermissionsQuery } from 'src/hooks/query-hooks';
import { createMission } from 'src/services/mutations/mission';
import { filteredProjects } from 'src/services/queries/project';
import { computed, ref, Ref } from 'vue';

const MIN_MISSION_NAME_LENGTH = 3;
const MAX_MISSION_NAME_LENGTH = 50;
const MISSION_NAME_INPUT_VALIDATION: ((value: string) => boolean | string)[] = [
    (value): boolean | string => !!value || 'Field is required',
    (value): boolean | string =>
        value.length >= MIN_MISSION_NAME_LENGTH ||
        `Name must be at least ${MIN_MISSION_NAME_LENGTH.toString()} characters`,
    (value): boolean | string =>
        value.length <= MAX_MISSION_NAME_LENGTH ||
        `Name must be at most ${MAX_MISSION_NAME_LENGTH.toString()} characters`,
    (value): boolean | string =>
        /^[\w\-_]+$/g.test(value) ||
        'Name must be alphanumeric and contain only - and _',
];

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const tab_selection = ref('meta_data');
const createFileReference = ref<InstanceType<typeof CreateFile> | undefined>(
    undefined,
);

const props = defineProps<{
    projectUuid: string | undefined;
    uploads: Ref<FileUploadDto[]>;
}>();

const projectUuid = ref(props.projectUuid);

const newMission: Ref<FlatMissionDto | undefined> = ref(undefined);
const queryClient = useQueryClient();

const { selectedProject: project } = useScopeSelection(projectUuid);

const missionName = ref('');
const isValidMissionName = ref(true);
const errorMessage = ref('');

const { data: all_projects } = useQuery<ProjectsDto>({
    queryKey: ['projects'],
    queryFn: () => filteredProjects(500, 0, 'name'),
});
const { data: permissions } = usePermissionsQuery();
const projectsWithCreateWrite = computed(() => {
    if (!all_projects.value) return [];
    return all_projects.value.data.filter((_project) =>
        canCreateMission(_project.uuid, permissions.value),
    );
});

const tagValues: Ref<Record<string, string>> = ref({});

const allRequiredTagsSet = computed(() => {
    return project.value?.requiredTags.every(
        (tag) =>
            tagValues.value[tag.uuid] !== undefined &&
            tagValues.value[tag.uuid] !== '',
    );
});

const missionCreated = computed(() => {
    return !!newMission.value;
});

const submitNewMission = async (): Promise<void> => {
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
                query.queryKey[1] === project.value?.uuid,
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
    if (createFileReference.value) {
        (createFileReference.value as any).createFileAction();
    }
    onDialogOK();
};

function onMissionNameChange(): void {
    errorMessage.value = '';
    isValidMissionName.value = true;
}

function navigateToMetadataTab(): void {
    tab_selection.value = 'tags';
}

function clearMissionName(): void {
    missionName.value = '';
}
</script>
