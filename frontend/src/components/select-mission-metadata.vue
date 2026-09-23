<template>
    <q-btn-dropdown
        v-model="ddr_open2"
        label="Add Optional Metadata"
        class="q-uploader--bordered full-width q-mb-lg"
        flat
        clearable
        required
        :disabled="availableAdditionalMetadataTypes.length === 0"
    >
        <q-tooltip v-if="availableAdditionalMetadataTypes.length === 0">
            All available metadata types have been added.
        </q-tooltip>
        <q-list>
            <q-item
                v-for="metadataType in availableAdditionalMetadataTypes"
                :key="metadataType.uuid"
                clickable
                @click="
                    () => {
                        addMetadataType(metadataType);
                        ddr_open2 = false;
                    }
                "
            >
                <q-item-section>
                    <q-item-label class="metadata-type-label">
                        <span>{{ metadataType.name }}</span>
                        <q-icon
                            v-if="metadataType.datatype"
                            :name="icon(metadataType.datatype)"
                            class="q-ml-sm"
                        >
                            <q-tooltip>
                                Metadata of Type {{ metadataType.datatype }}
                            </q-tooltip>
                        </q-icon>
                    </q-item-label>
                </q-item-section>
            </q-item>
        </q-list>
    </q-btn-dropdown>

    <template
        v-for="metadataType in [
            ...(project?.requiredMetadataTypes ?? []),
            ...additionalMetadataTypes,
        ] as MetadataTypeDto[]"
        :key="metadataType.uuid"
    >
        <div class="metadata-row">
            <div class="metadata-row__label">
                <label style="align-self: center">
                    {{ metadataType.name }}

                    <template
                        v-if="
                            requiredMetadataTypeUUIDs?.includes(
                                metadataType.uuid,
                            )
                        "
                    >
                        *
                    </template>
                </label>
                <q-chip square style="align-self: center">
                    {{ metadataType.datatype }}
                </q-chip>
            </div>

            <div class="metadata-row__input">
                <q-input
                    v-if="metadataType.datatype !== DataType.BOOLEAN"
                    v-model="localMetadataValues[metadataType.uuid]"
                    :placeholder="metadataType.name"
                    outlined
                    dense
                    required
                    style="flex-grow: 3"
                    :type="
                        // @ts-ignore
                        DataType_InputType[metadataType.datatype] ?? 'text'
                    "
                />
                <q-field
                    v-if="metadataType.datatype === DataType.BOOLEAN"
                    v-model="localMetadataValues[metadataType.uuid]"
                    :rules="[
                        (val) =>
                            val === true ||
                            val === false ||
                            'Please select a value',
                    ]"
                    color="black"
                    dense
                    outlined
                    hide-bottom-space
                    style="flex-grow: 8; align-self: center"
                >
                    <q-toggle
                        v-model="localMetadataValues[metadataType.uuid]"
                        :label="
                            localMetadataValues[metadataType.uuid] === undefined
                                ? 'Click toggle to define value'
                                : localMetadataValues[metadataType.uuid]
                                  ? 'True'
                                  : 'False'
                        "
                        outlined
                        dense
                        required
                        flat
                        style=""
                        :type="
                            DataType_InputType[metadataType.datatype] || 'text'
                        "
                        :options="[
                            { label: 'True', value: true },
                            { label: 'False', value: false },
                        ]"
                    />
                </q-field>

                <q-btn
                    icon="sym_o_delete"
                    class="text-red"
                    :color="metadataTypeColor(metadataType)"
                    round
                    flat
                    style="flex-grow: 1"
                    :disable="isRequired(metadataType)"
                    @click="() => removeMetadataType(metadataType.uuid)"
                >
                    <q-tooltip v-if="isRequired(metadataType)">
                        You cannot delete enforced metadata.
                    </q-tooltip>
                </q-btn>
            </div>
        </div>
    </template>
</template>

<script setup lang="ts">
import type { MetadataTypeDto } from '@kleinkram/api-dto/types/metadata/metadata.dto';
import { DataType } from '@kleinkram/shared';
import { useAllMetadataTypes, useProjectQuery } from 'src/hooks/query-hooks';
import { icon } from 'src/services/generic';
import { computed, Ref, ref, watch } from 'vue';

const properties = defineProps<{
    metadataValues: Record<string, string>;
    projectUuid: string;
}>();

const emit = defineEmits(['update:metadataValues']);

// eslint-disable-next-line @typescript-eslint/naming-convention
const ddr_open2 = ref(false);

// Create a shallow copy of metadataValues to make it editable locally
const localMetadataValues = ref({ ...properties.metadataValues });
const additionalMetadataTypes: Ref<MetadataTypeDto[]> = ref<MetadataTypeDto[]>(
    [],
);

// Keep local copy in sync with prop changes from parent
watch(
    () => properties.metadataValues,
    (newValue) => {
        const isDifferent =
            JSON.stringify(newValue) !==
            JSON.stringify(localMetadataValues.value);
        if (isDifferent) {
            localMetadataValues.value = { ...newValue };
        }
    },
    { deep: true, immediate: true },
);

// Watch for changes in localMetadataValues and emit them back to the parent
watch(
    localMetadataValues,
    (newValue) => {
        emit('update:metadataValues', newValue);
    },
    { deep: true },
);

const { data: metadataTypes } = useAllMetadataTypes();
const { data: project } = useProjectQuery(
    computed(() => properties.projectUuid),
);

watch(
    () => ({
        project: project.value,
        metadataTypes: metadataTypes.value,
        metadataTypeKeys: Object.keys(localMetadataValues.value).join(','),
    }),
    ({ project: newProject, metadataTypes: newMetadataTypes }) => {
        if (newProject && newMetadataTypes) {
            additionalMetadataTypes.value = [];
            for (const metadataTypeUUID of Object.keys(
                localMetadataValues.value,
            )) {
                if (
                    !newProject.requiredMetadataTypes
                        .map(
                            (requiredType: MetadataTypeDto) =>
                                requiredType.uuid,
                        )
                        .includes(metadataTypeUUID)
                ) {
                    const newMetadataType: MetadataTypeDto | undefined =
                        newMetadataTypes.find(
                            (metadataType: MetadataTypeDto) =>
                                metadataType.uuid === metadataTypeUUID,
                        );
                    if (newMetadataType === undefined) continue;
                    additionalMetadataTypes.value.push(newMetadataType);
                }
            }
        }
    },
    { immediate: true },
);

const availableAdditionalMetadataTypes: Ref<MetadataTypeDto[]> = computed(
    () => {
        if (metadataTypes.value === undefined) return [];
        let usedMetadataTypeUUIDs: string[] = [];
        if (project.value) {
            usedMetadataTypeUUIDs = project.value.requiredMetadataTypes.map(
                (metadataType) => metadataType.uuid,
            );
        }
        const addedMetadataTypeUUIDs = new Set(
            additionalMetadataTypes.value.map(
                (metadataType) => metadataType.uuid,
            ),
        );
        return metadataTypes.value.filter(
            (metadataType: MetadataTypeDto) =>
                !usedMetadataTypeUUIDs.includes(metadataType.uuid) &&
                !addedMetadataTypeUUIDs.has(metadataType.uuid),
        );
    },
);
// eslint-disable-next-line @typescript-eslint/naming-convention
const DataType_InputType = {
    [DataType.STRING]: 'text',
    [DataType.NUMBER]: 'number',
    [DataType.BOOLEAN]: 'checkbox',
    [DataType.DATE]: 'date',
    [DataType.LOCATION]: 'text',
};

const addMetadataType = (metadataType: MetadataTypeDto): void => {
    additionalMetadataTypes.value.push(metadataType);
    if (!(metadataType.uuid in localMetadataValues.value)) {
        // Use undefined for BOOLEAN so that the toggle starts in the neutral/undefined state
        localMetadataValues.value[metadataType.uuid] =
            metadataType.datatype === DataType.BOOLEAN
                ? (undefined as unknown as string)
                : '';
    }
};

const metadataTypeColor = (metadataType: MetadataTypeDto): string => {
    return isRequired(metadataType) ? 'grey' : 'black';
};

const isRequired = (metadataType: MetadataTypeDto): boolean => {
    if (requiredMetadataTypeUUIDs.value) {
        const requiredUUIDs = requiredMetadataTypeUUIDs.value;
        return requiredUUIDs.includes(metadataType.uuid);
    } else {
        return true;
    }
};

const requiredMetadataTypeUUIDs = computed(() =>
    project.value?.requiredMetadataTypes.map(
        (metadataType) => metadataType.uuid,
    ),
);

const removeMetadataType = (metadataTypeUUID: string): void => {
    const index = additionalMetadataTypes.value.findIndex(
        (metadataType) => metadataType.uuid === metadataTypeUUID,
    );
    if (index !== -1) {
        additionalMetadataTypes.value.splice(index, 1);
    }
    const { [metadataTypeUUID]: _, ...rest } = localMetadataValues.value;
    localMetadataValues.value = rest;
};
</script>
<style scoped>
.metadata-type-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.metadata-row {
    display: flex;
    flex-direction: row;
    justify-content: left;
    margin-bottom: 20px;
}

.metadata-row__label {
    display: flex;
    width: 200px;
    flex: 0 0 auto;
}

.metadata-row__input {
    display: flex;
    flex-direction: row;
    flex-grow: 2;
    min-width: 0;
}

@media (max-width: 599px) {
    .metadata-row {
        flex-direction: column;
        gap: 4px;
        margin-bottom: 16px;
    }

    .metadata-row__label {
        width: 100%;
    }
}
</style>
