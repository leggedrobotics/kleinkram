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
            <h3 class="text-h4 q-ma-none">
                {{ selectedTemplate ? 'Configure Action' : 'Create Action' }}
            </h3>
            <q-btn
                flat
                dense
                padding="6px"
                class="button-border"
                icon="sym_o_close"
                @click="closeDrawer"
            />
        </div>

        <q-separator />

        <div class="q-pa-lg">
            <span class="help-text">
                Actions are used to verify mission data or to generate derived
                files.
            </span>

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
                            v-model="selectedTemplate"
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
                        <label for="dockerImage">Docker Image</label>
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
                        <label>Access Rights</label>
                        <q-select
                            v-model="selectedAccessRights"
                            :options="accessOptions"
                            outlined
                            dense
                            map-options
                        />
                    </div>
                </div>

                <span class="text-h5" style="margin-top: 32px">
                    Compute Resources
                </span>
                <div style="margin-top: 16px" class="row q-col-gutter-sm">
                    <div class="col-6">
                        <label for="memory">Memory Allocation (GB)</label>
                        <q-input
                            v-model="editingTemplate.cpuMemory"
                            name="memory"
                            type="number"
                            class="q-mt-xs"
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
                            class="q-mt-xs"
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
                            class="q-mt-xs"
                            outlined
                            dense
                        />
                    </div>
                    <div class="col-6">
                        <label for="maxRuntime">Max Runtime (h)</label>
                        <q-input
                            v-if="editingTemplate"
                            v-model="editingTemplate.maxRuntime"
                            name="maxRuntime"
                            type="number"
                            class="q-mt-xs"
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
                        :label="saveButtonLabel"
                        :disable="!isModified || !isNameSelected"
                        :loading="isCreating || isUpdating"
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
                        :loading="isSubmitting"
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
import { ActionTemplateDto } from '@api/types/actions/action-template.dto';
import { CreateTemplateDto } from '@api/types/actions/create-template.dto';
import { MissionWithFilesDto } from '@api/types/mission/mission.dto';
import { ProjectDto } from '@api/types/project/base-project.dto';
import { AccessGroupRights } from '@common/enum';
import ActionSelector from 'components/action-selector.vue';
import { Notify } from 'quasar';
import {
    useFilteredProjects,
    useHandler,
    useManyMissions,
    useMissionsOfProjectMinimal,
} from 'src/hooks/query-hooks';
import { accessGroupRightsMap } from 'src/services/generic';
import { computed, Ref, ref, watch } from 'vue';

// 1. New Composable Imports
import {
    useCreateTemplate,
    useSubmitAction,
    useUpdateTemplateVersion,
} from 'src/composables/use-action-mutations';
import { useTemplateList } from 'src/composables/use-actions-queries';

// --- Props & Emits ---
const props = defineProps<{
    missionUuids?: string[];
    open: boolean;
    initialTemplate?: ActionTemplateDto;
}>();

const emits = defineEmits(['close']);

// --- State ---
const _open = ref(false);
const isNameSelected = ref(false);
const selectedTemplate = ref<ActionTemplateDto | undefined>(undefined);
const filter = ref('');
const selectedAccessRights = ref({
    label: 'Read',
    value: AccessGroupRights.READ,
});
const addedMissions = ref<string[]>([]);

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

const handler = useHandler();

// --- Computed Helpers ---
const saveButtonLabel = computed(() => {
    if (isNameSelected.value) {
        if (selectedTemplate.value?.uuid === '') {
            return 'Save New Template';
        } else if (isNameSelected.value) {
            return 'Save New Version';
        }
    }
    return 'Select Action';
});

const allMissionUUIDs = computed(() => [
    ...(props.missionUuids || []),
    ...addedMissions.value,
]);

const hasMissionUUIDs = computed(
    () => !!props.missionUuids && props.missionUuids.length > 0,
);

// --- Watchers ---
watch(
    () => props.open,
    (newValue_) => {
        _open.value = newValue_;
    },
    { immediate: true },
);

watch(
    () => _open.value,
    (newValue_) => {
        if (!newValue_) emits('close');
    },
);

watch(
    () => props.initialTemplate,
    (newValue_) => {
        if (newValue_) {
            selectedTemplate.value = structuredClone(newValue_);
        }
    },
    { immediate: true },
);

watch(selectedTemplate, () => {
    if (selectedTemplate.value) {
        isNameSelected.value = true;
        if (selectedTemplate.value.uuid === '') {
            newValue(selectedTemplate.value.name, () => ({}));
        } else {
            selectTemplate(selectedTemplate.value);
        }
    }
});

watch(
    () => selectedAccessRights.value,
    (newValue_) => {
        editingTemplate.value.accessRights = newValue_.value;
    },
);

// --- Mission/Project Queries (Existing Hooks) ---
const { data: selectedMissions } = useManyMissions(
    // @ts-ignore
    ['missions', allMissionUUIDs],
    allMissionUUIDs,
    hasMissionUUIDs,
);

const { data: projectsReturn } = useFilteredProjects(500, 0, 'name', false);
const projects = computed(() => projectsReturn.value?.data ?? []);
const selectedProject = computed(() =>
    projects.value.find((p) => p.uuid === handler.value.projectUuid),
);

const { data: _missions } = useMissionsOfProjectMinimal(
    computed(() => handler.value.projectUuid ?? ''),
    500,
    0,
);
const missions = computed(() => _missions.value?.data ?? []);
const selectedMission = computed(() =>
    missions.value.find((m) => m.uuid === handler.value.missionUuid),
);

// --- 2. Refactored Queries ---
// We use the new composable which supports search properly
const { data: templatesResult } = useTemplateList(
    computed(() => ({ search: filter.value })),
);

const actionTemplates = computed(() => templatesResult.value?.data ?? []);

// --- 3. Refactored Mutations ---
// Note: We destructure `isPending` (renamed to avoid conflict) to show loading states
const { mutateAsync: createTemplate, isPending: isCreating } =
    useCreateTemplate();
const { mutateAsync: updateTemplate, isPending: isUpdating } =
    useUpdateTemplateVersion();
const { mutateAsync: runAction, isPending: isSubmitting } = useSubmitAction();

// --- Actions ---
function closeDrawer(): void {
    _open.value = false;
}

async function saveAsTemplate(): Promise<void> {
    try {
        let result: ActionTemplateDto;

        // Construct DTO
        const payload = { ...editingTemplate.value };

        if (isModified.value && editingTemplate.value.uuid) {
            // Update Existing
            result = await updateTemplate(payload);
            Notify.create({
                message: `Template updated: ${result.name} v${result.version}`,
                color: 'positive',
                timeout: 2000,
            });
        } else {
            // Create New
            result = await createTemplate(payload as CreateTemplateDto);
            Notify.create({
                message: 'Template created',
                color: 'positive',
                timeout: 2000,
            });
        }

        // Update local state
        editingTemplate.value = result;
        selectedTemplate.value = structuredClone(result);
    } catch (error: any) {
        Notify.create({
            message: `Error: ${error.response?.data?.message ?? 'Unknown'}`,
            color: 'negative',
        });
    }
}

async function submitAnalysis(): Promise<void> {
    // 1. Validation
    if (
        !hasMissionUUIDs.value &&
        (!selectedProject.value || !selectedMission.value)
    ) {
        Notify.create({
            message: 'Please select a project and a mission',
            color: 'negative',
        });
        return;
    }

    const dockerhubNamespace = import.meta.env.VITE_DOCKER_HUB_NAMESPACE;
    if (
        dockerhubNamespace &&
        !editingTemplate.value.imageName.startsWith(`${dockerhubNamespace}`)
    ) {
        Notify.create({
            message: `Image name must start with "${dockerhubNamespace}/"`,
            color: 'negative',
        });
        return;
    }

    try {
        // 2. Upsert Template (Save before run)
        let template = editingTemplate.value;

        // We reuse the mutation logic, but we must await it here
        if (isModified.value && editingTemplate.value.uuid) {
            template = await updateTemplate(editingTemplate.value);
        } else if (!editingTemplate.value.uuid) {
            template = await createTemplate(
                editingTemplate.value as CreateTemplateDto,
            );
        }

        editingTemplate.value = template;
        selectedTemplate.value = structuredClone(template);

        // 3. Execution Logic (Using new composable)
        await runAction({
            templateUUID: template.uuid,
            missionUUID: hasMissionUUIDs.value
                ? undefined
                : selectedMission.value?.uuid,
            missionUUIDs: hasMissionUUIDs.value
                ? allMissionUUIDs.value
                : undefined,
        });

        Notify.create({ message: 'Analysis submitted', color: 'positive' });
        closeDrawer();
    } catch (error: any) {
        Notify.create({
            message: `Error: ${error.message || error.response?.data?.message || 'Unknown'}`,
            color: 'negative',
        });
    }
}

// --- Helpers ---
const isModified = computed(() => {
    if (!selectedTemplate.value) return true;
    const t = selectedTemplate.value;
    const template = editingTemplate.value;

    return !(
        template.name === t.name &&
        template.imageName === t.imageName &&
        template.command === t.command &&
        template.gpuMemory === t.gpuMemory &&
        template.cpuMemory === t.cpuMemory &&
        template.cpuCores === t.cpuCores &&
        template.maxRuntime === t.maxRuntime &&
        template.entrypoint === t.entrypoint &&
        template.accessRights === t.accessRights
    );
});

function newValue(value: string, done: any): void {
    const existing = actionTemplates.value.find((t) => t.name === value);
    if (existing) {
        editingTemplate.value = structuredClone(existing);
        selectedTemplate.value = existing;
    } else {
        editingTemplate.value.name = value;
    }
    done(editingTemplate);
}

function selectTemplate(template: ActionTemplateDto): void {
    if (!template || template.hasOwnProperty('_rawValue')) {
        if (!template) {
            editingTemplate.value = undefined;
            selectedTemplate.value = undefined;
        }
        return;
    }

    selectedAccessRights.value = {
        label: accessGroupRightsMap[template.accessRights] ?? '',
        value: template.accessRights,
    };
    editingTemplate.value = structuredClone(template);
}

function missionSelected(mission: MissionWithFilesDto): void {
    if (hasMissionUUIDs.value) {
        addedMissions.value.push(mission.uuid);
    } else {
        handler.value.setMissionUUID(mission.uuid);
    }
}

const projectSelected = (a: ProjectDto): void => {
    handler.value.setProjectUUID(a.uuid);
};

const canRemoveMission = (uuid: string): void =>
    addedMissions.value.includes(uuid);

const removeMission = (uuid: string): void => {
    addedMissions.value = addedMissions.value.filter((id) => id !== uuid);
};

const accessOptions = Object.keys(accessGroupRightsMap)
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
</script>
