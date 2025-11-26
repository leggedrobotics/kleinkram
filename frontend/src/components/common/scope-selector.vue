<template>
    <div :class="containerClass">
        <div :class="itemClass">
            <AppSelect
                :model-value="effectiveProjectUuid"
                :options="projects"
                :label="showLabels ? 'Project' : undefined"
                :required="required"
                :readonly="!!fixedProjectUuid"
                :loading="isProjectsLoading"
                :disable="isProjectsLoading"
                clearable
                dense
                option-label="name"
                option-value="uuid"
                placeholder="Select Project"
                :rules="projectRules"
                @update:model-value="handleProjectChange"
            />
        </div>

        <div :class="itemClass">
            <AppSelect
                :model-value="effectiveMissionUuid"
                :options="missions"
                :label="showLabels ? 'Mission' : undefined"
                :required="required"
                :disable="!effectiveProjectUuid || isMissionsLoading"
                :loading="isMissionsLoading"
                clearable
                dense
                option-label="name"
                option-value="uuid"
                placeholder="Select Mission"
                :rules="missionRules"
                @update:model-value="handleMissionChange"
            >
                <template #no-option>
                    <q-item>
                        <q-item-section class="text-grey text-italic">
                            No missions found for this project
                        </q-item-section>
                    </q-item>
                </template>
            </AppSelect>
        </div>
    </div>
</template>

<script setup lang="ts">
import AppSelect from 'components/common/app-select.vue';
import { ValidationRule } from 'quasar';
import { useScopeSelection } from 'src/composables/use-scope-selection';
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        layout?: 'row' | 'column';
        mode?: 'edit' | 'filter';
        showLabels?: boolean;
        required?: boolean;
        fixedProjectUuid?: string | undefined;
        currentMissionUuid?: string | undefined;
        customMissionRules?: ValidationRule[];
    }>(),
    {
        layout: 'column',
        mode: 'edit',
        showLabels: true,
        required: false,
        customMissionRules: () => [],
        fixedProjectUuid: undefined,
        currentMissionUuid: undefined,
    },
);

const emit =
    defineEmits<
        (
            event: 'project-selected' | 'mission-selected',
            uuid: string | undefined,
        ) => void
    >();

const {
    projects,
    missions,
    selectedProjectUuid,
    selectedMissionUuid,
    setProject,
    setMission,
    isProjectsLoading,
    isMissionsLoading,
} = useScopeSelection();

const effectiveProjectUuid = computed(
    () => props.fixedProjectUuid ?? selectedProjectUuid.value,
);
const effectiveMissionUuid = computed(
    () => props.currentMissionUuid ?? selectedMissionUuid.value,
);

const handleProjectChange = (uuid: string | null | undefined): void => {
    const value = uuid ?? undefined;
    if (!props.fixedProjectUuid) {
        setProject(value);
    }
    emit('project-selected', value);
};

const handleMissionChange = (uuid: string | null | undefined): void => {
    const value = uuid ?? undefined;
    if (!props.currentMissionUuid) {
        setMission(value);
    }
    emit('mission-selected', value);
};

// --- Layout ---
const containerClass = computed(() =>
    props.layout === 'row'
        ? 'row q-col-gutter-sm items-start'
        : 'column q-gutter-y-md',
);
const itemClass = computed(() =>
    props.layout === 'row' ? 'col-auto' : 'col-12',
);

// --- Validation ---
const projectRules = computed(() => {
    return props.required
        ? [
              (value: string | null | undefined): boolean | string =>
                  !!value || 'Project is required',
          ]
        : [];
});

const missionRules = computed(() => {
    if (props.customMissionRules && props.customMissionRules.length > 0)
        return props.customMissionRules;
    return props.required
        ? [
              (value: string | null | undefined): boolean | string =>
                  !!value || 'Mission is required',
          ]
        : [];
});
</script>
