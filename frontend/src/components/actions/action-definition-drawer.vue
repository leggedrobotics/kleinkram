<template>
    <q-drawer
        v-model="_open"
        side="right"
        :width="800"
        style="bottom: 0 !important"
        bordered
        behavior="desktop"
    >
        <div
            class="q-pa-lg flex row justify-between items-center"
            style="height: 84px"
        >
            <h3 class="text-h4 q-ma-none">
                {{
                    mode === ActionDrawerMode.ACTION_RESTORE
                        ? 'Restore Action Template Version'
                        : isEditing
                          ? 'Edit Action Template'
                          : 'Create Action Template'
                }}
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
                Define the technical specifications for an action. These
                settings serve as the blueprint for future executions.
            </span>

            <q-form
                ref="actionForm"
                class="flex column q-mt-md"
                @submit.prevent="saveTemplate"
            >
                <span class="text-h5">Template Details</span>

                <div class="flex column q-gutter-y-md q-mt-sm">
                    <div>
                        <label class="text-weight-bold">
                            Action Name <span class="text-negative">*</span>
                        </label>
                        <q-input
                            v-model="localTemplate.name"
                            outlined
                            dense
                            placeholder="e.g. Lidar Validation"
                            :readonly="isEditing"
                            :hint="
                                isEditing
                                    ? 'Name cannot be changed when creating a new version'
                                    : ''
                            "
                            lazy-rules
                            :rules="[
                                (val) => !!val || 'Name is required',
                                () =>
                                    isNameAvailable ||
                                    'This name is already taken',
                            ]"
                            :error="
                                !isNameAvailable &&
                                !isCheckingName &&
                                !!localTemplate.name &&
                                !isEditing
                            "
                            error-message="This action name is already in use."
                            @update:model-value="onNameChange"
                        >
                            <template
                                v-if="!isEditing && localTemplate.name"
                                #append
                            >
                                <q-spinner
                                    v-if="isCheckingName"
                                    color="primary"
                                    size="1em"
                                >
                                    <q-tooltip
                                        anchor="top middle"
                                        self="bottom middle"
                                    >
                                        Validating action name availability...
                                    </q-tooltip>
                                </q-spinner>

                                <q-icon
                                    v-else-if="
                                        isNameAvailable && !nameCheckDirty
                                    "
                                    name="sym_o_check_circle"
                                    color="positive"
                                />
                            </template>
                        </q-input>
                    </div>

                    <div>
                        <label class="text-weight-bold">
                            Description <span class="text-negative">*</span>
                        </label>
                        <q-input
                            v-model="localTemplate.description"
                            outlined
                            dense
                            type="textarea"
                            rows="3"
                            placeholder="Describe what this action does..."
                            lazy-rules
                            :rules="[
                                (val) => !!val || 'Description is required',
                            ]"
                        />
                    </div>

                    <div>
                        <label class="text-weight-bold">
                            Docker Image <span class="text-negative">*</span>
                        </label>
                        <q-input
                            v-model="localTemplate.imageName"
                            outlined
                            dense
                            placeholder="registry.example.com/namespace/image:tag"
                            lazy-rules
                            :rules="[
                                (val) => !!val || 'Docker image is required',
                                (val) =>
                                    isValidDockerImageName(val) ||
                                    'Invalid image name. Only alphanumeric, dots, hyphens, and underscores are allowed.',
                            ]"
                        />
                    </div>
                    <div>
                        <label class="text-weight-bold">Default Command</label>
                        <q-input
                            v-model="localTemplate.command"
                            outlined
                            dense
                            placeholder="Command to execute"
                        />
                    </div>
                    <div>
                        <label class="text-weight-bold">Entrypoint</label>
                        <q-input
                            v-model="localTemplate.entrypoint"
                            outlined
                            dense
                            placeholder="Overwrite Entrypoint"
                        />
                    </div>
                    <div>
                        <label class="text-weight-bold">
                            File Access Rights
                        </label>
                        <q-select
                            v-model="selectedAccessRights"
                            :options="accessOptions"
                            outlined
                            dense
                            map-options
                            emit-value
                        />
                    </div>
                </div>

                <span class="text-h5 q-mt-lg">Compute Resources</span>
                <ComputeResourcesSelector
                    :cpu-cores="localTemplate.cpuCores ?? 1"
                    :cpu-memory="localTemplate.cpuMemory ?? 2"
                    :gpu-memory="localTemplate.gpuMemory ?? -1"
                    :max-runtime="localTemplate.maxRuntime ?? 2"
                    @update:cpu-cores="onUpdateCpuCores"
                    @update:cpu-memory="onUpdateCpuMemory"
                    @update:gpu-memory="onUpdateGpuMemory"
                    @update:max-runtime="onUpdateMaxRuntime"
                />

                <q-separator class="q-my-lg" />

                <div class="row justify-end q-gutter-x-sm">
                    <q-btn
                        flat
                        label="Cancel"
                        color="grey-7"
                        @click="closeDrawer"
                    />
                    <q-btn
                        unelevated
                        class="bg-button-secondary text-on-color"
                        :label="
                            mode === ActionDrawerMode.ACTION_RESTORE
                                ? 'Restore Version'
                                : isEditing
                                  ? 'Save New Version'
                                  : 'Create Template'
                        "
                        type="submit"
                        :loading="isSaving"
                        :disable="!isNameAvailable && !isEditing"
                    />
                </div>
            </q-form>
        </div>
    </q-drawer>
</template>

<script setup lang="ts">
import type { ActionTemplateDto } from '@kleinkram/api-dto/types/actions/action-template.dto';
import type { CreateTemplateDto } from '@kleinkram/api-dto/types/actions/create-template.dto';
import type { UpdateTemplateDto } from '@kleinkram/api-dto/types/actions/update-template.dto';
import { AccessGroupRights } from '@kleinkram/shared';
import { isValidDockerImageName } from '@kleinkram/validation/frontend';
import ComputeResourcesSelector from 'components/actions/compute-resources-selector.vue';
import { debounce, Notify, QForm } from 'quasar';
import { ActionService } from 'src/api/services/action.service';
import {
    useCreateTemplate,
    useUpdateTemplateVersion,
} from 'src/composables/use-action-mutations';
import { ActionDrawerMode } from 'src/router/enums';
import { accessGroupRightsMap } from 'src/services/generic';
import { computed, nextTick, ref, watch } from 'vue';

const props = defineProps<{
    open: boolean;
    mode?: ActionDrawerMode;
    initialTemplate?: ActionTemplateDto | undefined;
}>();

const emits = defineEmits(['close', 'saved']);

const _open = ref(false);
const isSaving = ref(false);
const actionForm = ref<QForm | null>();

// Name Validation State
const isCheckingName = ref(false);
const isNameAvailable = ref(true);
const nameCheckDirty = ref(false);

const defaultTemplate: CreateTemplateDto = {
    name: '',
    description: '',
    command: '',
    dockerImage: '',
    cpuCores: 2,
    cpuMemory: 4,
    gpuMemory: -1,
    maxRuntime: 2,
    entrypoint: '',
    accessRights: AccessGroupRights.READ,
};

// eslint-disable-next-line @typescript-eslint/no-misused-spread
const localTemplate = ref<Partial<ActionTemplateDto>>({ ...defaultTemplate });

// Access Rights Options
const selectedAccessRights = computed({
    get: () => localTemplate.value.accessRights ?? AccessGroupRights.READ,
    set: (value) => {
        localTemplate.value.accessRights = value;
    },
});

const accessOptions = Object.keys(accessGroupRightsMap)
    .filter(
        (key) =>
            (Number.parseInt(key) as AccessGroupRights) !==
            AccessGroupRights._ADMIN,
    )
    .map((key) => ({
        label: accessGroupRightsMap[
            Number.parseInt(key, 10) as AccessGroupRights
        ],
        value: Number.parseInt(key, 10),
    }));

const isEditing = computed(() => !!props.initialTemplate?.uuid);

// --- Composable Hooks ---
const { mutateAsync: createTemplate } = useCreateTemplate();
const { mutateAsync: updateTemplate } = useUpdateTemplateVersion();

// --- Name Validation Logic ---

// We still use ActionService directly for this debounce check as it's not a reactive query
const checkName = debounce(async (name: string) => {
    if (!name || isEditing.value) {
        isCheckingName.value = false;
        nameCheckDirty.value = false;
        return;
    }

    try {
        isNameAvailable.value = await ActionService.checkNameAvailability(name);
    } catch (error) {
        console.error('Failed to check name availability', error);
        isNameAvailable.value = true;
    } finally {
        isCheckingName.value = false;
        nameCheckDirty.value = false;
    }
}, 500);

function onNameChange(value: string | number | null): void {
    if (isEditing.value) return;

    // Reset state immediately on type
    isNameAvailable.value = true;
    nameCheckDirty.value = true;

    if (value === null) {
        isCheckingName.value = false;
        nameCheckDirty.value = false;
        return;
    }
    if (value.toString().length > 0) {
        isCheckingName.value = true;
        checkName(value.toString());
    } else {
        isCheckingName.value = false;
        nameCheckDirty.value = false;
    }
}

// --- Watchers ---

watch(
    () => props.open,
    (value) => {
        _open.value = value;
        if (value) {
            isNameAvailable.value = true;
            isCheckingName.value = false;
            nameCheckDirty.value = false;

            // eslint-disable-next-line unicorn/prefer-ternary
            if (props.initialTemplate) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                localTemplate.value = {
                    // eslint-disable-next-line unicorn/prefer-structured-clone
                    ...JSON.parse(JSON.stringify(props.initialTemplate)),
                    imageName: props.initialTemplate.imageName,
                };
            } else {
                // eslint-disable-next-line @typescript-eslint/no-misused-spread
                localTemplate.value = { ...defaultTemplate };
            }

            void nextTick(() => {
                actionForm.value?.resetValidation();
            });
        }
    },
);

watch(
    () => _open.value,
    (value) => {
        if (!value) emits('close');
    },
);

// --- Saving Logic ---

async function saveTemplate(): Promise<void> {
    // Client side guard
    if (!isEditing.value && !isNameAvailable.value) {
        return;
    }

    isSaving.value = true;
    try {
        const basePayload = {
            name: localTemplate.value.name ?? '',
            description: localTemplate.value.description ?? '',
            command: localTemplate.value.command ?? '',
            dockerImage: localTemplate.value.imageName ?? '',
            cpuCores: localTemplate.value.cpuCores ?? 1,
            cpuMemory: localTemplate.value.cpuMemory ?? 2,
            maxRuntime: localTemplate.value.maxRuntime ?? 2,
            entrypoint: localTemplate.value.entrypoint ?? '',
            accessRights:
                localTemplate.value.accessRights ?? AccessGroupRights.READ,
            gpuMemory: localTemplate.value.gpuMemory ?? -1,
        };

        // 2. Validate Namespace
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const dockerhubNamespace = import.meta.env.VITE_DOCKER_HUB_NAMESPACE;
        if (
            dockerhubNamespace &&
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            !basePayload.dockerImage.startsWith(`${dockerhubNamespace}`)
        ) {
            throw new Error(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `Image name must start with "${dockerhubNamespace}/"`,
            );
        }

        // 3. Send to Backend via Composable
        if (isEditing.value && props.initialTemplate?.uuid) {
            const updatePayload: UpdateTemplateDto = {
                ...basePayload,
                uuid: props.initialTemplate.uuid,
            };
            await updateTemplate(updatePayload);
            Notify.create({
                message: `New version created`,
                color: 'positive',
            });
        } else {
            await createTemplate(basePayload as CreateTemplateDto);
            Notify.create({
                message: 'Action Template Created',
                color: 'positive',
            });
        }

        emits('saved');
        closeDrawer();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        Notify.create({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            message: error.message ?? 'Error saving template',
            color: 'negative',
        });
    } finally {
        isSaving.value = false;
    }
}

function closeDrawer(): void {
    _open.value = false;
}

function onUpdateCpuCores(value: number): void {
    localTemplate.value.cpuCores = value;
}

function onUpdateCpuMemory(value: number): void {
    localTemplate.value.cpuMemory = value;
}

function onUpdateGpuMemory(value: number): void {
    localTemplate.value.gpuMemory = value;
}

function onUpdateMaxRuntime(value: number): void {
    localTemplate.value.maxRuntime = value;
}
</script>
