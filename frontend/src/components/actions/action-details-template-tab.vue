<template>
    <div class="q-pa-md">
        <div class="row q-col-gutter-md">
            <div class="col-12">
                <q-banner class="bg-blue-1 text-blue-10 rounded-borders">
                    This execution ran using
                    <strong
                        >{{ template.name }} (Rev
                        {{ template.version }})</strong
                    >.
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
            <div class="col-12">
                <AppInput
                    label="Description"
                    :model-value="template.description"
                    type="textarea"
                    readonly
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
// Props: template object passed from the parent ActionDto
defineProps<{ template: any }>();
const formatDate = (d) => new Date(d).toLocaleString();
</script>
