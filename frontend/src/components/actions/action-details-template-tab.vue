<template>
    <div class="q-pa-md">
        <div class="row q-col-gutter-md">
            <div class="col-12">
                <q-banner class="bg-blue-1 text-blue-10 rounded-borders">
                    This execution ran using
                    <strong>
                        {{ template.name }} (v {{ template.version }})
                        </strong>.
                    <div class="text-caption q-mt-xs">
                        Defined by {{ template.creator?.name }} on
                        {{ formatDate(template.createdAt) }}
                    </div>
                </q-banner>
            </div>

            <div class="col-6">
                <AppInput
                    label="Docker Image"
                    :model-value="template.imageName"
                    readonly
                />
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

// Props: template object passed from the parent ActionDto
defineProps<{ template: ActionTemplateDto }>();
const formatDate = (d: string | Date) => new Date(d).toLocaleString();
</script>
