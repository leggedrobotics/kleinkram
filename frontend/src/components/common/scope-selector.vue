<template>
    <div :class="containerClass">
        <div :class="itemClass" :style="itemStyle">
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
                :placeholder="dynamicProjectPlaceholder"
                :rules="projectRules"
                searchable
                @update:model-value="handleProjectChange"
            />
        </div>

        <div v-if="showMission" :class="itemClass" :style="itemStyle">
            <AppSelect
                :model-value="selectedMissionUuid"
                :options="missions"
                :label="showLabels ? 'Mission' : undefined"
                :required="required"
                :disable="isMissionDisabled"
                :loading="isMissionsLoading"
                clearable
                dense
                outlined
                bg-color="white"
                option-label="name"
                option-value="uuid"
                :placeholder="dynamicMissionPlaceholder"
                :rules="missionRules"
                searchable
                @update:model-value="handleMissionChange"
            />
            <q-tooltip v-if="isMissionDisabled && missionDisabledReason">
                {{ missionDisabledReason }}
            </q-tooltip>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ProjectWithRequiredTagsDto } from '@kleinkram/api-dto/types/project/project-with-required-tags.dto';
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
        selectWidth?: string | undefined;
        bgColor?: string | undefined;
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
        selectWidth: undefined,
        bgColor: undefined,
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
    const vNodeProperties = instance?.vnode.props ?? {};
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

const itemClass = computed(() => {
    if (props.layout === 'row') {
        return props.selectWidth ? 'col-auto' : 'col';
    }
    return 'col-12';
});

const itemStyle = computed(() => {
    return props.selectWidth ? { width: props.selectWidth } : {};
});

const projectRules = computed(() => {
    return props.required
        ? [
              (value: string | null | undefined): boolean | string =>
                  !!value || 'Project is required',
          ]
        : [];
});

const missionRules = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (props.customMissionRules && props.customMissionRules.length > 0)
        return props.customMissionRules;
    return props.required
        ? [
              (value: string | null | undefined): boolean | string =>
                  !!value || 'Mission is required',
          ]
        : [];
});

// Dynamic placeholders showing example based on first available option
const dynamicProjectPlaceholder = computed(() => {
    if (selectedProjectUuid.value) return;
    const first = projects.value[0];
    return first ? `e.g. ${first.name}` : props.projectPlaceholder;
});

const dynamicMissionPlaceholder = computed(() => {
    if (selectedMissionUuid.value) return;
    if (!selectedProjectUuid.value) return 'Select a Project';
    const first = missions.value[0];
    return first ? `e.g. ${first.name}` : props.missionPlaceholder;
});

// Check if mission is disabled to show tooltip
const isMissionDisabled = computed(() => {
    return (
        props.disabled || !selectedProjectUuid.value || isMissionsLoading.value
    );
});

const missionDisabledReason = computed(() => {
    if (!selectedProjectUuid.value) return 'Select a project first';
    if (isMissionsLoading.value) return 'Loading missions...';
    return '';
});
</script>
