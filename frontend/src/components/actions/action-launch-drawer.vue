<template>
    <q-drawer
        v-model="_open"
        side="right"
        :width="1000"
        style="bottom: 0 !important"
        bordered
        behavior="desktop"
    >
        <DrawerHeader
            title="Launch Action"
            :subtitle="
                template ? `${template.name} (v${template.version})` : ''
            "
            @close="closeDrawer"
        />

        <q-separator />

        <div class="q-pa-lg">
            <InfoBanner
                text="Need a different action configuration?"
                button-label="Create New Action"
                @click="createAction"
            />

            <q-form @submit.prevent="submitAnalysis">
                <span class="text-h5">Execution Scope</span>
                <div class="q-mt-sm">
                    <ScopeSelector
                        layout="column"
                        required
                        :current-mission-uuid="selectedMission?.uuid"
                        :custom-mission-rules="[
                            (val) =>
                                hasMissionUUIDs ||
                                !!val ||
                                'Mission is required',
                        ]"
                        @mission-selected="handleMissionSelect"
                    />

                    <div v-if="hasMissionUUIDs" class="row q-gutter-xs q-mt-sm">
                        <q-chip
                            v-for="m in selectedMissionsData?.data ?? []"
                            :key="m.uuid"
                            removable
                            color="primary"
                            text-color="white"
                            icon="sym_o_flag"
                            @remove="() => removeMission(m.uuid)"
                        >
                            {{ m.name }}
                        </q-chip>
                    </div>
                </div>

                <q-separator class="q-my-lg" />

                <span class="text-h5">Action Configuration</span>
                <p class="text-grey-7 q-mb-md">
                    Review the configuration for this run.
                </p>

                <div class="flex column q-gutter-y-md">
                    <AppInput
                        :model-value="template?.imageName ?? null"
                        label="Docker Image"
                        readonly
                    >
                        <template #prepend>
                            <q-icon name="sym_o_layers" />
                        </template>
                        <template #default>
                            <q-tooltip>
                                To change this field, a new action version must
                                be created.
                            </q-tooltip>
                        </template>
                    </AppInput>

                    <AppInput
                        v-model="runtimeCommand"
                        label="Command"
                        placeholder="Use Default"
                        hint="Leave empty to use the template default"
                    />
                </div>

                <div class="q-mt-md">
                    <ComputeResourcesFieldset
                        :model-value="computeStats"
                        readonly
                    />
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
                        label="Launch Action"
                        icon="sym_o_rocket_launch"
                        type="submit"
                        :loading="isSubmitting"
                        :disable="!canSubmit"
                    />
                </div>
            </q-form>
        </div>
    </q-drawer>
</template>

<script setup lang="ts">
import { Notify } from 'quasar';
import { computed, ref, watch } from 'vue';

// --- Shared Components ---
import ComputeResourcesFieldset from 'components/actions/compute-resources-fieldset.vue';
import AppInput from 'components/common/app-input.vue';
import DrawerHeader from 'components/common/drawer-header.vue';
import ScopeSelector from 'components/common/scope-selector.vue';
import InfoBanner from 'components/info-banner.vue';

// --- Hooks & Services ---
import { useQueryClient } from '@tanstack/vue-query';
import { actionKeys } from 'src/api/keys/action-keys';
import { useSubmitAction } from 'src/composables/use-action-mutations';
import { useScopeSelection } from 'src/composables/use-scope-selection';
import { useManyMissions } from 'src/hooks/query-hooks';

// --- Types ---
import { ActionTemplateDto } from '@api/types/actions/action-template.dto';

const props = defineProps<{
    open: boolean;
    template?: ActionTemplateDto | undefined;
    missionUuids?: string[];
}>();

const emits = defineEmits(['close', 'create-action']);

// --- State ---
const queryClient = useQueryClient();
const _open = ref(false);
const runtimeCommand = ref('');
const addedMissions = ref<string[]>([]);

const { mutateAsync: launchAction, isPending: isSubmitting } =
    useSubmitAction();

// --- Logic Reuse (Composable) ---
const { selectedProject, selectedMission, setMission } = useScopeSelection();

// --- Computed Helpers ---
const allMissionUUIDs = computed(() => [
    ...(props.missionUuids || []),
    ...addedMissions.value,
]);
const hasMissionUUIDs = computed(() => allMissionUUIDs.value.length > 0);

const { data: selectedMissionsData } = useManyMissions(
    computed(() => ['missions', allMissionUUIDs.value]),
    allMissionUUIDs,
    hasMissionUUIDs,
);

const computeStats = computed(() => ({
    cpuCores: props.template?.cpuCores ?? 0,
    cpuMemory: props.template?.cpuMemory ?? 0,
    maxRuntime: props.template?.maxRuntime ?? 0,
    gpuMemory: props.template?.gpuMemory ?? -1,
}));

// --- Watchers ---
watch(
    () => props.open,
    (value) => {
        _open.value = value;
        if (value && props.template) {
            runtimeCommand.value = props.template.command;
            addedMissions.value = [];
        }
    },
);

watch(
    () => _open.value,
    (value) => {
        if (!value) emits('close');
    },
);

// --- Handlers ---
function handleMissionSelect(uuid: string): void {
    if (hasMissionUUIDs.value) {
        if (!addedMissions.value.includes(uuid)) {
            addedMissions.value.push(uuid);
        }
    } else {
        setMission(uuid);
    }
}

function removeMission(uuid: string): void {
    addedMissions.value = addedMissions.value.filter((id) => id !== uuid);
}

function closeDrawer(): void {
    _open.value = false;
}

const canSubmit = computed(() => {
    return (
        !!props.template &&
        (hasMissionUUIDs.value ||
            (selectedProject.value && selectedMission.value))
    );
});

async function submitAnalysis(): Promise<void> {
    if (!props.template) return;

    try {
        // The Composable handles the distinction between single and multi internally
        await launchAction({
            templateUUID: props.template.uuid,
            missionUUID:
                !hasMissionUUIDs.value && selectedMission.value
                    ? selectedMission.value.uuid
                    : undefined,
            missionUUIDs: hasMissionUUIDs.value
                ? allMissionUUIDs.value
                : undefined,
        });

        Notify.create({
            message: 'Action Launched Successfully',
            color: 'positive',
        });

        await queryClient.invalidateQueries({
            queryKey: actionKeys.templates.all,
        });
        await queryClient.invalidateQueries({
            queryKey: actionKeys.all,
        });

        closeDrawer();
    } catch (error: any) {
        Notify.create({
            message: error.message || 'Launch Failed',
            color: 'negative',
        });
    }
}

const createAction = (): void => {
    emits('create-action');
    closeDrawer();
};
</script>
