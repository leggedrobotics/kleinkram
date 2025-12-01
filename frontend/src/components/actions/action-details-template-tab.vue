<template>
    <div class="q-pa-md">
        <div class="row q-col-gutter-md">
            <div class="col-6">
                <AppInput
                    label="Template Name"
                    :model-value="template.name"
                    readonly
                />
            </div>
            <div class="col-6">
                <AppInput
                    label="Version"
                    :model-value="template.version"
                    readonly
                />
            </div>
            <div class="col-6">
                <AppInput
                    label="Creator"
                    :model-value="template.creator?.name || 'N/A'"
                    readonly
                />
            </div>
            <div class="col-6">
                <AppInput
                    label="Created At"
                    :model-value="formatDate(template.createdAt)"
                    readonly
                />
            </div>

            <div class="col-6">
                <AppInput
                    label="Docker Image"
                    :model-value="template.imageName"
                    readonly
                >
                    <template v-if="dockerHubUrl" #append>
                        <q-btn
                            flat
                            round
                            dense
                            icon="sym_o_open_in_new"
                            color="grey-7"
                            @click.stop="openDockerHub"
                        >
                            <q-tooltip>View on Docker Hub</q-tooltip>
                        </q-btn>
                    </template>
                </AppInput>
            </div>
            <div class="col-6">
                <AppInput
                    label="Command"
                    :model-value="template.command || 'Default'"
                    readonly
                />
            </div>
            <div class="col-6">
                <AppInput
                    label="Entrypoint"
                    :model-value="template.entrypoint || 'Default'"
                    readonly
                />
            </div>
            <div class="col-6">
                <AppInput
                    label="Access Rights"
                    :model-value="
                        accessGroupRightsMap[
                            template.accessRights as AccessGroupRights
                        ]
                    "
                    readonly
                />
            </div>
            <div class="col-12">
                <AppInput
                    label="Description"
                    :model-value="template.description"
                    type="textarea"
                    readonly
                />
            </div>

            <div class="col-12">
                <q-separator class="q-my-sm" />
                <ComputeResourcesFieldset :model-value="template" readonly />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ActionTemplateDto } from '@api/types/actions/action-template.dto';
import { AccessGroupRights } from '@common/enum';
import ComputeResourcesFieldset from 'components/actions/compute-resources-fieldset.vue';
import AppInput from 'components/common/app-input.vue';
import { accessGroupRightsMap } from 'src/services/generic';
import { computed } from 'vue';

// Props: template object passed from the parent ActionDto
const props = defineProps<{ template: ActionTemplateDto }>();
const formatDate = (d: string | Date) => new Date(d).toLocaleString();

const openDockerHub = () => {
    if (dockerHubUrl.value) {
        window.open(dockerHubUrl.value, '_blank');
    }
};

const dockerHubUrl = computed(() => {
    const image = props.template.imageName;
    if (
        image.includes('localhost') ||
        image.includes(':5000') ||
        image.includes('ghcr.io')
    )
        return '';

    const parts = image.split('/');
    if (parts.length === 1 && parts[0]) {
        // Official image, e.g. "ubuntu" -> https://hub.docker.com/_/ubuntu
        return `https://hub.docker.com/_/${parts[0].split(':')[0]}`;
    }
    if (parts.length === 2 && parts[0] && parts[1]) {
        // User image, e.g. "rslethz/kleinkram" -> https://hub.docker.com/r/rslethz/kleinkram
        return `https://hub.docker.com/r/${parts[0]}/${parts[1].split(':')[0]}`;
    }
    return '';
});
</script>
