<template>
    <div :class="containerClass">
        <div :class="itemClass">
            <AppSelect
                :model-value="selectedProjectUuid"
                :options="projects"
                :label="showLabels ? 'Project' : undefined"
                :required="required"
                :disable="disabled || isProjectsLoading || !!fixedProjectUuid"
                :loading="isProjectsLoading"
                clearable
                dense
                outlined
                bg-color="white"
                option-label="name"
                option-value="uuid"
                :input-label="showLabels ? undefined : projectPlaceholder"
                :rules="projectRules"
                @update:model-value="handleProjectChange"
            />
        </div>

        <div v-if="showMission" :class="itemClass">
            <AppSelect
                :model-value="selectedMissionUuid"
                :options="missions"
                :label="showLabels ? 'Mission' : undefined"
                :required="required"
                :disable="disabled || !selectedProjectUuid || isMissionsLoading"
                :loading="isMissionsLoading"
                clearable
                dense
                outlined
                bg-color="white"
                option-label="name"
                option-value="uuid"
                :input-label="showLabels ? undefined : missionPlaceholder"
                :rules="missionRules"
                @update:model-value="handleMissionChange"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ProjectWithRequiredTagsDto } from '@api/types/project/project-with-required-tags.dto';
import AppSelect from 'components/common/app-select.vue';
import { ValidationRule } from 'quasar';
import { useScopeSelection } from 'src/composables/use-scope-selection';
import { computed, getCurrentInstance, toRef } from 'vue';

const props = withDefaults(
    defineProps<{
        layout?: 'row' | 'column';
        showLabels?: boolean;
        showMission?: boolean;
        required?: boolean;
        disabled?: boolean;
        fixedProjectUuid?: string | undefined;
        projectUuid?: string | undefined;
        missionUuid?: string | undefined;
        customProjects?: ProjectWithRequiredTagsDto[] | undefined;
        customMissionRules?: ValidationRule[];
        projectPlaceholder?: string;
        missionPlaceholder?: string;
    }>(),
    {
        layout: 'column',
        showLabels: true,
        showMission: true,
        required: false,
        disabled: false,
        fixedProjectUuid: undefined,
        projectUuid: undefined,
        missionUuid: undefined,
        customProjects: undefined,
        customMissionRules: () => [],
        projectPlaceholder: 'Select Project',
        missionPlaceholder: 'Select Mission',
    },
);

const emit =
    defineEmits<
        (
            event: 'update:projectUuid' | 'update:missionUuid',
            value: string | undefined,
        ) => void
    >();

const instance = getCurrentInstance();

const isGlobalMode = computed(() => {
    const vNodeProperties = instance?.vnode.props || {};
    const hasProjectBinding = 'onUpdate:projectUuid' in vNodeProperties;
    const hasFixedProject = !!props.fixedProjectUuid;
    return !hasProjectBinding && !hasFixedProject;
});

const {
    projects,
    missions,
    selectedProjectUuid,
    selectedMissionUuid,
    setProject,
    setMission,
    isProjectsLoading,
    isMissionsLoading,
} = useScopeSelection(
    isGlobalMode.value
        ? undefined
        : computed({
              get: () => props.projectUuid ?? props.fixedProjectUuid,
              set: (value) => {
                  emit('update:projectUuid', value);
              },
          }),
    isGlobalMode.value
        ? undefined
        : computed({
              get: () => props.missionUuid,
              set: (value) => {
                  emit('update:missionUuid', value);
              },
          }),
    toRef(props, 'customProjects'),
);

const handleProjectChange = (value: string | null | undefined): void => {
    setProject(value ?? undefined);
};

const handleMissionChange = (value: string | null | undefined): void => {
    setMission(value ?? undefined);
};

// --- Layout & Rules ---
const containerClass = computed(() =>
    props.layout === 'row'
        ? 'row q-col-gutter-sm items-start'
        : 'column q-gutter-y-md',
);

const itemClass = computed(() => (props.layout === 'row' ? 'col' : 'col-12'));

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
