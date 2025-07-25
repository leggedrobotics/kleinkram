<template>
    <q-drawer
        v-model="_open"
        side="right"
        :width="1000"
        style="bottom: 0 !important"
        bordered
        behavior="desktop"
    >
        <div class="q-pa-lg flex row justify-between" style="height: 84px">
            <h3 class="text-h4 q-ma-none">Submit new Action</h3>
            <q-btn
                flat
                dense
                padding="6px"
                class="button-border"
                icon="sym_o_close"
                @click="submitNewAction"
            />
        </div>

        <q-separator />

        <div class="q-pa-lg">
            <span class="help-text">
                Actions are used to verify mission data or to generate derived
                files.
            </span>

            <!-- Select a project and mission, on which the analysis will be performed -->
            <q-form
                class="flex column"
                style="margin-top: 24px"
                @submit.prevent="submitAnalysis"
            >
                <span class="text-h5">Basic Information</span>
                <div class="flex column" style="gap: 12px; margin-top: 16px">
                    <div>
                        <label>Select Action</label>
                        <ActionSelector
                            ref="myElement"
                            v-model="selectedTemplate as ActionTemplateDto"
                            :action-templates="actionTemplates"
                        />
                    </div>
                    <div>
                        <label for="project">Project</label>
                        <q-select
                            name="project"
                            :model-value="selectedProject?.name"
                            :options="projects"
                            option-label="name"
                            option-value="uuid"
                            placeholder="Project"
                            outlined
                            dense
                            class="q-mb-sm"
                            style="background-color: #f4f4f4"
                            @update:model-value="projectSelected"
                        />
                    </div>
                    <div>
                        <label for="mission">Mission</label>
                        <q-select
                            :model-value="selectedMission?.name"
                            :options="missions"
                            option-label="name"
                            placeholder="Mission"
                            name="mission"
                            outlined
                            dense
                            class="q-mb-sm"
                            style="background-color: #f4f4f4"
                            @update:model-value="missionSelected"
                        />
                    </div>
                    <div v-if="hasMissionUUIDs">
                        <q-chip
                            v-for="chip_mission in selectedMissions?.data ?? []"
                            :key="chip_mission.uuid"
                            :removable="canRemoveMission(chip_mission.uuid)"
                            @remove="() => removeMission(chip_mission.uuid)"
                        >
                            {{ chip_mission.name }}
                        </q-chip>
                    </div>
                </div>
                <span class="text-h5" style="margin-top: 32px"
                    >Define the Action</span
                >
                <div class="flex column" style="gap: 12px; margin-top: 16px">
                    <div>
                        <label for="dockerImage">Define the Action</label>
                        <q-input
                            v-model="editingTemplate.imageName"
                            name="dockerImage"
                            outlined
                            dense
                            class="q-mb-sm"
                            clearable
                            placeholder="Docker Image"
                        />
                    </div>

                    <div>
                        <label for="action_trigger">Define the Trigger</label>

                        <q-input
                            name="action_trigger"
                            model-value="Manually Triggered"
                            outlined
                            readonly
                            dense
                            class="q-mb-sm"
                            clearable
                            placeholder="Action Trigger"
                        />
                    </div>

                    <div>
                        <label for="action_command">Command</label>
                        <q-input
                            v-if="editingTemplate"
                            v-model="editingTemplate.command"
                            name="action_command"
                            outlined
                            dense
                            class="q-mb-sm"
                            clearable
                            placeholder="Command"
                        />
                    </div>
                    <div>
                        <label for="action_entrypoint">Entrypoint</label>
                        <q-input
                            v-if="editingTemplate"
                            v-model="editingTemplate.entrypoint"
                            name="action_entrypoint"
                            outlined
                            dense
                            class="q-mb-sm"
                            clearable
                            placeholder="Entrypoint"
                        />
                    </div>
                    <div>
                        <q-select
                            v-model="selectedAccessRights"
                            :options="options"
                            label="Select Access Rights"
                            map-options
                            style=""
                        />
                    </div>
                </div>

                <span class="text-h5" style="margin-top: 32px">
                    Compute Resources
                </span>
                <div style="margin-top: 16px" class="flex">
                    <div class="col-6">
                        <label for="memory">Memory Allocation (GB)</label>
                        <q-input
                            v-model="editingTemplate.cpuMemory"
                            name="memory"
                            type="number"
                            placholder="Memory Allocation (GB)"
                            class="q-ma-sm"
                            style="margin: 1px"
                            outlined
                            dense
                        />
                    </div>
                    <div class="col-6">
                        <label for="cpu">CPU Core Allocation</label>
                        <q-input
                            v-model="editingTemplate.cpuCores"
                            name="cpu"
                            type="number"
                            style="margin: 1px"
                            outlined
                            dense
                        />
                    </div>
                    <div class="col-6">
                        <label for="gpu">GPU Memory (-1 for no GPU)</label>
                        <q-input
                            v-if="editingTemplate"
                            v-model="editingTemplate.gpuMemory"
                            name="gpu"
                            type="number"
                            emit-value
                            style="margin: 1px"
                            outlined
                            dense
                        />
                    </div>
                    <div class="col-6">
                        <label for="gpu">Max Runtime (h)</label>
                        <q-input
                            v-if="editingTemplate"
                            v-model="editingTemplate.maxRuntime"
                            name="gpu"
                            type="number"
                            style="margin: 1px"
                            emit-value
                            outlined
                            dense
                        />
                    </div>
                </div>

                <q-separator class="q-my-md" />

                <div class="flex row justify-end q-mt-lg">
                    <q-btn
                        flat
                        class="bg-button-secondary text-on-color q-mx-sm"
                        :label="saveButtonLable"
                        :disable="!isModified || !isNameSelected"
                        @click="saveAsTemplate"
                    >
                        <q-tooltip v-if="!isNameSelected">
                            Cant save Template without a Name
                        </q-tooltip>
                        <q-tooltip v-else-if="!isModified">
                            Can't save a Template that is unmodified
                        </q-tooltip>
                    </q-btn>
                    <q-btn
                        flat
                        class="bg-button-secondary text-on-color"
                        label="Submit Action"
                        :disable="!isNameSelected"
                        @click="submitAnalysis"
                    >
                        <q-tooltip v-if="!isNameSelected">
                            Cant submit Action without a name
                        </q-tooltip>
                    </q-btn>
                </div>
            </q-form>
        </div>
    </q-drawer>
</template>
<script setup lang="ts">
import { computed, Ref, ref, watch } from 'vue';

import { ActionTemplateDto } from '@api/types/actions/action-template.dto';
import {
    FlatMissionDto,
    MissionWithFilesDto,
} from '@api/types/mission/mission.dto';
import { ProjectDto } from '@api/types/project/base-project.dto';
import { ProjectWithMissionCountDto } from '@api/types/project/project-with-mission-count.dto';
import { ActionSubmitResponseDto } from '@api/types/submit-action-response.dto';
import { AccessGroupRights } from '@common/enum';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import ActionSelector from 'components/action-selector.vue';
import { Notify } from 'quasar';
import {
    useFilteredProjects,
    useHandler,
    useManyMissions,
    useMissionsOfProjectMinimal,
} from 'src/hooks/query-hooks';
import { accessGroupRightsMap } from 'src/services/generic';
import {
    createActionTemplate,
    createAnalysis,
    createMultipleAnalysis,
    createNewActionTemplateVersion,
} from 'src/services/mutations/action';
import { listActionTemplates } from 'src/services/queries/action';

const isNameSelected: Ref<boolean> = ref<boolean>(false);

const saveButtonLable = computed(() => {
    if (isNameSelected.value) {
        if (selectedTemplate.value?.uuid === '') {
            //Creating New Template
            return 'Save New Template';
        } else if (isNameSelected.value) {
            //Existing and Modified Template
            return 'Save New Version';
        }
    }
    //No Template Selected
    return 'Select Action';
});

const selectedTemplate = ref<ActionTemplateDto | undefined>(undefined);

watch(selectedTemplate, () => {
    if (selectedTemplate.value) {
        isNameSelected.value = true;
        if (selectedTemplate.value.uuid === '') {
            //Got New Template
            console.log('Handling New template');
            newValue(selectedTemplate.value.name, () => ({}));
        } else {
            //Got Existing Template
            console.log('handling Existing Template');
            selectTemplate(selectedTemplate.value);
        }
    } else {
        throw new Error('selectedTemplate undefined in watcher');
    }
});

const filter = ref('');
const selectedAccessRights = ref({
    label: 'Read',
    value: AccessGroupRights.READ,
});

const queryClient = useQueryClient();
const handler = useHandler();
const _open = ref(false);

const emits = defineEmits(['close']);

const properties = defineProps<{
    missionUuids?: string[];
    open: boolean;
}>();

const addedMissions = ref<string[]>([]);
const allMissionUUIDs = computed(() => {
    return [...(properties.missionUuids || []), ...addedMissions.value];
});
const editingTemplate: Ref = ref({
    imageName: '',
    command: '',
    cpuCores: 1,
    cpuMemory: 2,
    gpuMemory: 2,
    maxRuntime: -1,
    version: 1,
    entrypoint: '',
    accessRights: AccessGroupRights.READ,
});
// QUERYING ####################################################################
// Fetch missions based on props ----------------------------------------------

const hasMissionUUIDs = computed(
    () => !!properties.missionUuids && properties.missionUuids.length > 0,
);
const { data: selectedMissions } = useManyMissions(
    // @ts-ignore
    ['missions', allMissionUUIDs],
    allMissionUUIDs,
    hasMissionUUIDs,
);
// Fetch projects
const { data: projectsReturn } = useFilteredProjects(500, 0, 'name', false);
const projects = computed(() =>
    projectsReturn.value ? projectsReturn.value.data : [],
);

const selectedProject = computed(() =>
    projects.value.find(
        (project: ProjectWithMissionCountDto) =>
            project.uuid === handler.value.projectUuid,
    ),
);

watch(
    () => selectedAccessRights.value,
    (_newValue) => {
        editingTemplate.value.accessRights = _newValue.value;
    },
);

// Fetch mission based on selected project -------------------------------------

const { data: _missions } = useMissionsOfProjectMinimal(
    computed(() => handler.value.projectUuid ?? ''),
    500,
    0,
);
const missions = computed(() => (_missions.value ? _missions.value.data : []));

const selectedMission = computed(() =>
    missions.value.find(
        (mission: FlatMissionDto) => mission.uuid === handler.value.missionUuid,
    ),
);

// Fetch action templates -----------------------------------------------------

const actionTemplateKey = computed(() => ['actionTemplates', filter.value]);
const { data: actionTemplatesResult } = useQuery({
    queryKey: actionTemplateKey,
    queryFn: () => listActionTemplates(''),
});
const actionTemplates = ref<ActionTemplateDto[]>(
    actionTemplatesResult.value?.data ?? [],
);
watch(actionTemplatesResult, () => {
    actionTemplates.value = actionTemplatesResult.value?.data ?? [];
});

// MUTATING ###################################################################
// Save the template ----------------------------------------------------------
async function saveAsTemplate() {
    let result: undefined | ActionTemplateDto;
    // eslint-disable-next-line unicorn/prefer-ternary
    if (isModified.value && editingTemplate.value.uuid) {
        // @ts-ignore
        result = await updateTemplate(true);
    } else {
        result = await createTemplate(true);
    }
    editingTemplate.value = result;
    // here we cannot use structured clone
    // eslint-disable-next-line unicorn/prefer-structured-clone
    selectedTemplate.value = JSON.parse(JSON.stringify(result));
}

const { mutateAsync: createTemplate } = useMutation({
    mutationFn: (searchable: boolean) =>
        createActionTemplate({
            name: editingTemplate.value.name,
            command: editingTemplate.value.command,
            dockerImage: editingTemplate.value.imageName,
            cpuCores: editingTemplate.value.cpuCores,
            cpuMemory: editingTemplate.value.cpuMemory,
            gpuMemory: editingTemplate.value.gpuMemory,
            maxRuntime: editingTemplate.value.maxRuntime,
            searchable,
            entrypoint: editingTemplate.value.entrypoint,
            accessRights: editingTemplate.value.accessRights,
        }),
    onSuccess: async () => {
        await queryClient.invalidateQueries({
            predicate: (query) => {
                return query.queryKey[0] === 'actionTemplates';
            },
        });
        Notify.create({
            group: false,
            message: 'Template created',
            color: 'positive',
            position: 'bottom',
            timeout: 2000,
        });
    },
    onError: (error: { response?: { data: { message: string } } }) => {
        console.error(error);
        Notify.create({
            group: false,
            message: `Error: ${error.response?.data.message ?? 'Unknown Error'}`,
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
    },
});

const { mutateAsync: updateTemplate } = useMutation({
    mutationFn: (searchable: boolean) =>
        createNewActionTemplateVersion({
            uuid: editingTemplate.value.uuid,
            name: editingTemplate.value.name,
            command: editingTemplate.value.command,
            dockerImage: editingTemplate.value.imageName,
            cpuCores: editingTemplate.value.cpuCores,
            cpuMemory: editingTemplate.value.cpuMemory,
            gpuMemory: editingTemplate.value.gpuMemory,
            maxRuntime: editingTemplate.value.maxRuntime,
            searchable,
            entrypoint: editingTemplate.value.entrypoint,
            accessRights: editingTemplate.value.accessRights,
        }),
    onSuccess: async (newValue_: { name: string; version: string }) => {
        await queryClient.invalidateQueries({
            predicate: (query) => {
                return query.queryKey[0] === 'actionTemplates';
            },
        });
        Notify.create({
            group: false,
            message: `Template updated: ${newValue_.name} v${newValue_.version}`,
            color: 'positive',
            position: 'bottom',
            timeout: 2000,
        });
    },
    onError: (error: { response: { data: { message: string } } }) => {
        Notify.create({
            group: false,
            message: `Error: ${error.response.data.message}`,
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
    },
});

async function submitAnalysis() {
    // validate input (this will also be performed on the backend)
    // the user must select a project and a mission
    // the image name must start with 'rslethz/'
    if (
        !hasMissionUUIDs.value &&
        (!selectedProject.value || !selectedMission.value)
    ) {
        Notify.create({
            group: false,
            message: 'Please select a project and a mission',
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
        return;
    }
    if (!editingTemplate.value.imageName.startsWith('rslethz/')) {
        Notify.create({
            group: false,
            message: 'The image name must start with "rslethz/"',
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
        return;
    }

    // post: the input should be valid now
    let template = editingTemplate.value;

    if (isModified.value && editingTemplate.value.uuid) {
        console.log('updating template');
        template = await updateTemplate(false);
    } else if (!editingTemplate.value.uuid) {
        console.log('createTemplate template');

        template = await createTemplate(false);
    }
    editingTemplate.value = template;
    // here we cannot use structured clone
    // eslint-disable-next-line unicorn/prefer-structured-clone
    selectedTemplate.value = JSON.parse(JSON.stringify(template));

    let createPromise: Promise<ActionSubmitResponseDto>;
    if (hasMissionUUIDs.value) {
        createPromise = createMultipleAnalysis({
            missionUUIDs: allMissionUUIDs.value,
            templateUUID: template.uuid,
        });
    } else if (selectedMission.value) {
        createPromise = createAnalysis({
            missionUUID: selectedMission.value.uuid,
            templateUUID: template.uuid,
        });
    } else {
        Notify.create({
            group: false,
            message: 'Please select a mission',
            color: 'negative',
            position: 'bottom',
            timeout: 2000,
        });
        return;
    }
    // send the action request to the backend and show a notification
    createPromise
        .then(async () => {
            Notify.create({
                group: false,
                message: 'Analysis submitted',
                color: 'positive',
                position: 'bottom',
                timeout: 2000,
            });

            // flush actions cache
            await queryClient.invalidateQueries({
                predicate: (query) => {
                    return query.queryKey[0] === 'action_mission';
                },
            });
        })
        .catch((error: unknown) => {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown Error';

            Notify.create({
                group: false,
                message: `Error: ${errorMessage}`,
                color: 'negative',
                position: 'bottom',
                timeout: 2000,
            });
        });
}

// HELPER FUNCTIONS ############################################################
// const isModified =

const isModified = computed(() => {
    if (!selectedTemplate.value) {
        //should never Happen?
        return true;
    }
    const sameName = editingTemplate.value.name === selectedTemplate.value.name;
    const sameImage =
        editingTemplate.value?.imageName === selectedTemplate.value.imageName;
    const sameCommand =
        editingTemplate.value?.command === selectedTemplate.value.command;
    const sameGPU =
        editingTemplate.value?.gpuMemory === selectedTemplate.value.gpuMemory;

    const sameMemory =
        editingTemplate.value?.cpuMemory === selectedTemplate.value.cpuMemory;
    const sameCores =
        editingTemplate.value?.cpuCores === selectedTemplate.value.cpuCores;
    const sameRuntime =
        editingTemplate.value?.maxRuntime === selectedTemplate.value.maxRuntime;
    const sameEntrypoint =
        editingTemplate.value?.entrypoint === selectedTemplate.value.entrypoint;
    const sameAccessRights =
        editingTemplate.value?.accessRights ===
        selectedTemplate.value.accessRights;
    return !(
        sameName &&
        sameImage &&
        sameCommand &&
        sameGPU &&
        sameMemory &&
        sameCores &&
        sameRuntime &&
        sameEntrypoint &&
        sameAccessRights
    );
});

function newValue(value: string, done: any) {
    const existingTemplate = actionTemplatesResult.value?.data.find(
        (template: ActionTemplateDto) => template.name === value,
    );
    if (existingTemplate) {
        // here we cannot use structured clone
        // eslint-disable-next-line unicorn/prefer-structured-clone
        editingTemplate.value = JSON.parse(JSON.stringify(existingTemplate));
        selectedTemplate.value = existingTemplate;
    }
    editingTemplate.value.name = value;
    done(editingTemplate);
}

function selectTemplate(template: ActionTemplateDto) {
    if (!template) {
        editingTemplate.value = undefined;
        selectedTemplate.value = undefined;
        return;
    }
    if (template.hasOwnProperty('_rawValue')) {
        return;
    }
    selectedAccessRights.value = {
        label: accessGroupRightsMap[template.accessRights] ?? '',
        value: template.accessRights,
    };

    // here we cannot use structured clone
    // eslint-disable-next-line unicorn/prefer-structured-clone
    editingTemplate.value = JSON.parse(JSON.stringify(template));
}

function missionSelected(mission: MissionWithFilesDto) {
    if (hasMissionUUIDs.value) {
        addedMissions.value.push(mission.uuid);
    } else {
        handler.value.setMissionUUID(mission.uuid);
    }
}

const projectSelected = (a: ProjectDto) => {
    console.log('projectSelected', a);
    handler.value.setProjectUUID(a.uuid);
};

function canRemoveMission(missionUuid: string) {
    return addedMissions.value.includes(missionUuid);
}

function removeMission(uuid: string) {
    addedMissions.value = addedMissions.value.filter((id) => id !== uuid);
}

watch(
    () => properties.open,
    (newValue_) => {
        _open.value = newValue_;
    },
    { immediate: true },
);
watch(
    () => _open.value,
    (_newValue) => {
        if (!_newValue) {
            emits('close');
        }
    },
);

const options = Object.keys(accessGroupRightsMap)
    .filter(
        (key) =>
            (Number.parseInt(key) as AccessGroupRights) !==
            AccessGroupRights._ADMIN,
    )
    .map((key) => ({
        label:
            accessGroupRightsMap[
                Number.parseInt(key, 10) as AccessGroupRights
            ] ?? '',
        value: Number.parseInt(key, 10),
    }));

function submitNewAction(): void {
    _open.value = false;
}
</script>
<style scoped></style>
