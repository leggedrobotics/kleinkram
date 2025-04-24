<template>
    <div class="q-pa-lg">
        <q-form @submit.prevent="submitAnalysis">
            <ActionTemplateSelection
                v-model:parent-template="state.actionTemplate.templateName"
                v-model:template-name="state.actionTemplate.templateName"
                v-model:errors="actionConfigurationInputValidation"
            />

            <MissionSelection
                v-model:mission-uuids="state.missionUuids"
                v-model:errors="actionConfigurationInputValidation"
            />

            <ActionDefinition
                v-model:image-name="state.actionDefinition.imageName"
                v-model:trigger="state.actionDefinition.trigger"
                v-model:command="state.actionDefinition.command"
                v-model:entrypoint="state.actionDefinition.entrypoint"
                v-model:access-rights="state.accessRights"
                v-model:errors="actionConfigurationInputValidation"
            />

            <ComputeResources
                v-model:cpu-memory="state.actionResources.cpuMemory"
                v-model:cpu-cores="state.actionResources.cpuCores"
                v-model:gpu="state.actionResources.gpu"
                v-model:max-runtime="state.actionResources.maxRuntime"
                v-model:errors="actionConfigurationInputValidation"
            />

            <q-separator class="q-my-md" />
            <ActionFooter
                :errors="actionConfigurationInputValidation"
                @save="saveAsTemplate"
                @submit="submitAnalysis"
            />
        </q-form>
    </div>
</template>

<script setup lang="ts">
import { AccessGroupRights } from '@common/enum';
import ActionFooter from 'components/action-submission/action-footer.vue';
import ActionDefinition from 'components/action-submission/settings/action-definition.vue';
import ActionTemplateSelection from 'components/action-submission/settings/action-template-selection.vue';
import ComputeResources from 'components/action-submission/settings/compute-resources.vue';
import MissionSelection from 'components/action-submission/settings/mission-selection.vue';
import {
    ActionConfiguration,
    ActionConfigurationValidationError,
} from 'components/action-submission/types';
import { reactive, ref } from 'vue';

const defaultActionConfiguration: ActionConfiguration = {
    missionUuids: [],

    // template name and version
    actionTemplate: {
        templateName: '',
        parentTemplate: undefined,
    },

    actionDefinition: {
        imageName: '',
        trigger: 'Manually Triggered',
        command: '',
        entrypoint: '',
    },

    accessRights: { label: 'Read', value: AccessGroupRights.READ },

    actionResources: {
        cpuMemory: 1,
        cpuCores: 1,
        gpu: {
            useGPU: false,
            gpuModel: '',
            gpuMemory: 0,
        },
        maxRuntime: 1,
    },
};

const actionConfigurationInputValidation = ref<
    ActionConfigurationValidationError[]
>([]);

const state = reactive<ActionConfiguration>(defaultActionConfiguration);

const saveAsTemplate = (): void => {
    console.log('Saving as template:', JSON.stringify(state, undefined, 2));
};

const submitAnalysis = (): void => {
    console.log('Saving as template:', JSON.stringify(state, undefined, 2));
};
</script>
