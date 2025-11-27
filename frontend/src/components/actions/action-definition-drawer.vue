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
                    isEditing
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
                                (val) =>
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
                        <label class="text-weight-bold">Description</label>
                        <q-input
                            v-model="localTemplate.description"
                            outlined
                            dense
                            type="textarea"
                            rows="3"
                            placeholder="Describe what this action does..."
                        />
                    </div>

                    <div>
                        <label class="text-weight-bold">
                            Docker Image <span class="text-negative">*</span>
                        </label>
                        <q-input
                            v-model="localTemplate.dockerImage"
                            outlined
                            dense
                            placeholder="registry.example.com/namespace/image:tag"
                            lazy-rules
                            :rules="[
                                (val) => !!val || 'Docker image is required',
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
                <div class="row q-col-gutter-md q-mt-xs">
                    <div class="col-6">
                        <label>
                            Memory (GB) <span class="text-negative">*</span>
                        </label>
                        <q-input
                            v-model.number="localTemplate.cpuMemory"
                            type="number"
                            outlined
                            dense
                            lazy-rules
                            :rules="[
                                (val) =>
                                    (val !== null && val !== '') ||
                                    'Memory is required',
                            ]"
                        />
                    </div>
                    <div class="col-6">
                        <label>
                            CPU Cores <span class="text-negative">*</span>
                        </label>
                        <q-input
                            v-model.number="localTemplate.cpuCores"
                            type="number"
                            outlined
                            dense
                            lazy-rules
                            :rules="[
                                (val) =>
                                    (val !== null && val !== '') ||
                                    'CPU Cores is required',
                            ]"
                        />
                    </div>
                    <div class="col-6">
                        <label>
                            Max Runtime (h) <span class="text-negative">*</span>
                        </label>
                        <q-input
                            v-model.number="localTemplate.maxRuntime"
                            type="number"
                            outlined
                            dense
                            lazy-rules
                            :rules="[
                                (val) =>
                                    (val !== null && val !== '') ||
                                    'Runtime is required',
                            ]"
                        />
                    </div>

                    <div class="col-12 flex items-center q-mt-sm">
                        <q-toggle
                            v-model="gpuEnabled"
                            label="Enable GPU Acceleration"
                        />
                    </div>

                    <div v-if="gpuEnabled" class="col-6">
                        <label>
                            GPU Memory (GB) <span class="text-negative">*</span>
                        </label>
                        <q-input
                            v-model.number="localTemplate.gpuMemory"
                            type="number"
                            outlined
                            dense
                            lazy-rules
                            :rules="[
                                (val) =>
                                    val > 0 || 'GPU Memory must be positive',
                            ]"
                        />
                    </div>
                </div>

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
                            isEditing ? 'Save New Version' : 'Create Template'
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
import { ActionTemplateDto } from '@api/types/actions/action-template.dto';
import { CreateTemplateDto } from '@api/types/actions/create-template.dto';
import { UpdateTemplateDto } from '@api/types/actions/update-template.dto';
import { AccessGroupRights } from '@common/enum';
import { debounce, Notify, QForm } from 'quasar';
import { ActionService } from 'src/api/services/action.service';
import {
    useCreateTemplate,
    useUpdateTemplateVersion,
} from 'src/composables/use-action-mutations';
import { accessGroupRightsMap } from 'src/services/generic';
import { computed, nextTick, ref, watch } from 'vue';

const props = defineProps<{
    open: boolean;
    initialTemplate?: ActionTemplateDto;
}>();

const emits = defineEmits(['close', 'saved']);

const _open = ref(false);
const isSaving = ref(false);
const gpuEnabled = ref(false);
const actionForm = ref<QForm | null>(null);

// Name Validation State
const isCheckingName = ref(false);
const isNameAvailable = ref(true);
const nameCheckDirty = ref(false);

const defaultTemplate: CreateTemplateDto = {
    name: '',
    description: '',
    command: '',
    dockerImage: '',
    cpuCores: 1,
    cpuMemory: 2,
    gpuMemory: -1,
    maxRuntime: 2,
    entrypoint: '',
    accessRights: AccessGroupRights.READ,
};

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

function onNameChange(value: string): void {
    if (isEditing.value) return;

    // Reset state immediately on type
    isNameAvailable.value = true;
    nameCheckDirty.value = true;

    if (value && value.length > 0) {
        isCheckingName.value = true;
        checkName(value);
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

            if (props.initialTemplate) {
                // EDIT MODE
                localTemplate.value = {
                    ...JSON.parse(JSON.stringify(props.initialTemplate)),
                    dockerImage: props.initialTemplate.imageName,
                };
            } else {
                // CREATE MODE
                localTemplate.value = { ...defaultTemplate };
            }

            gpuEnabled.value = (localTemplate.value.gpuMemory ?? -1) > -1;
            if (gpuEnabled.value && !localTemplate.value.gpuMemory) {
                localTemplate.value.gpuMemory = 6;
            }

            nextTick(() => {
                actionForm.value?.resetValidation();
            });
        }
    },
);

watch(gpuEnabled, (enabled) => {
    if (
        enabled &&
        (localTemplate.value.gpuMemory === -1 || !localTemplate.value.gpuMemory)
    ) {
        localTemplate.value.gpuMemory = 6;
    }
});

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
            name: localTemplate.value.name!,
            description: localTemplate.value.description ?? '',
            command: localTemplate.value.command ?? '',
            dockerImage: localTemplate.value.dockerImage!,
            cpuCores: localTemplate.value.cpuCores!,
            cpuMemory: localTemplate.value.cpuMemory!,
            maxRuntime: localTemplate.value.maxRuntime!,
            entrypoint: localTemplate.value.entrypoint ?? '',
            accessRights:
                localTemplate.value.accessRights ?? AccessGroupRights.READ,
            gpuMemory: gpuEnabled.value
                ? (localTemplate.value.gpuMemory ?? 6)
                : -1,
        };

        // 2. Validate Namespace
        const dockerhubNamespace = import.meta.env.VITE_DOCKER_HUB_NAMESPACE;
        if (
            dockerhubNamespace &&
            !basePayload.dockerImage.startsWith(`${dockerhubNamespace}`)
        ) {
            throw new Error(
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
    } catch (error: any) {
        Notify.create({
            message: error.message || 'Error saving template',
            color: 'negative',
        });
    } finally {
        isSaving.value = false;
    }
}

function closeDrawer(): void {
    _open.value = false;
}
</script>
