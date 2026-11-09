<template>
    <div class="metadata-filter-builder column q-gutter-y-md">
        <!-- Add New Metadata Filter -->
        <div class="row q-gutter-x-sm items-center">
            <div class="col-grow">
                <q-select
                    v-model="selectedMetadataTypeToAdd"
                    :options="filteredMetadataTypes"
                    :placeholder="metadataPlaceholder"
                    option-label="name"
                    dense
                    outlined
                    use-input
                    fill-input
                    hide-selected
                    input-debounce="0"
                    clearable
                    bg-color="white"
                    @filter="filterMetadataTypes"
                    @update:model-value="addMetadataTypeFilter"
                >
                    <template #no-option>
                        <q-item>
                            <q-item-section class="text-grey">
                                No metadata types found.
                            </q-item-section>
                        </q-item>
                    </template>
                </q-select>
            </div>
        </div>

        <!-- Active Metadata Filters -->
        <div
            v-if="Object.keys(localMetadataValues).length === 0"
            class="text-grey-6 text-center q-pa-sm"
        >
            No metadata filters active.
        </div>

        <div v-else class="column q-gutter-y-sm">
            <div
                v-for="metadataTypeUUID in Object.keys(localMetadataValues)"
                :key="metadataTypeUUID"
                class="row items-start q-gutter-x-sm bg-grey-1 q-pa-sm rounded-borders"
            >
                <div class="col-grow">
                    <MetadataFilterInput
                        :metadata-type-uuid="metadataTypeUUID"
                        :metadata-type-lookup="metadataTypeLookup"
                        :metadata-values="localMetadataValues"
                        @update:metadata-values="updateLocalMetadataValues"
                    />
                </div>
                <div class="col-auto">
                    <q-btn
                        flat
                        dense
                        icon="sym_o_close"
                        color="negative"
                        aria-label="Remove metadata filter"
                        class="remove-metadata-filter"
                        @click="() => removeMetadataType(metadataTypeUUID)"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { MetadataTypeDto } from '@kleinkram/api-dto/types/metadata/metadata.dto';
import MetadataFilterInput from 'components/metadata-filter-input.vue';
import { useAllMetadataTypes } from 'src/hooks/query-hooks';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modelValue: Record<string, { name: string; value: any }>;
}>();

const emit = defineEmits<
    (
        event: 'update:modelValue',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: Record<string, { name: string; value: any }>,
    ) => void
>();

const { data: allMetadataTypes } = useAllMetadataTypes();

// Local state to manage the UI before emitting
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const localMetadataValues = ref<Record<string, { value: any; name: string }>>(
    {},
);

watch(
    () => props.modelValue,
    (value) => {
        // Deep sync needed to keep local state consistent with props
        localMetadataValues.value = { ...value };
    },
    { immediate: true, deep: true },
);

function updateLocalMetadataValues(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newVals: Record<string, { value: any; name: string }>,
) {
    localMetadataValues.value = newVals;
    emit('update:modelValue', localMetadataValues.value);
}

function removeMetadataType(uuid: string) {
    const { [uuid]: _removed, ...rest } = localMetadataValues.value;
    updateLocalMetadataValues(rest);
}

// --- Metadata Type Search ---
const selectedMetadataTypeToAdd = ref<MetadataTypeDto | null>(null);
const filteredMetadataTypes = ref<MetadataTypeDto[]>([]);

function filterMetadataTypes(
    value: string,
    update: (function_: () => void) => void,
) {
    if (!allMetadataTypes.value) {
        update(() => {
            filteredMetadataTypes.value = [];
        });
        return;
    }
    update(() => {
        const needle = value.toLowerCase();
        // available = all metadata types NOT yet in localMetadataValues
        const available = allMetadataTypes.value.filter(
            (t) => !localMetadataValues.value[t.uuid],
        );

        // Deduplicate suggestions by name
        const seenNames = new Set<string>();
        const uniqueMetadataTypes: MetadataTypeDto[] = [];

        for (const metadataType of available) {
            if (
                metadataType.name.toLowerCase().includes(needle) &&
                !seenNames.has(metadataType.name)
            ) {
                uniqueMetadataTypes.push(metadataType);
                seenNames.add(metadataType.name);
            }
        }

        filteredMetadataTypes.value = uniqueMetadataTypes;
    });
}

function addMetadataTypeFilter(selectedMetadataType: MetadataTypeDto | null) {
    if (!selectedMetadataType || !allMetadataTypes.value) return;

    // We must use a new object reference to trigger reactivity
    const newVals = { ...localMetadataValues.value };

    // Find ALL metadata types with the same name as the selected one (ignoring case)
    const matchingMetadataTypes = allMetadataTypes.value.filter(
        (t) => t.name.toLowerCase() === selectedMetadataType.name.toLowerCase(),
    );

    // Add all of them
    for (const metadataType of matchingMetadataTypes) {
        // Initialize with empty value if not already present
        newVals[metadataType.uuid] ??= {
            name: metadataType.name,
            value: undefined,
        };
    }

    updateLocalMetadataValues(newVals);

    // Reset input
    selectedMetadataTypeToAdd.value = null;
}

// Metadata Type Lookup for the Input Component
const metadataTypeLookup = computed(() => {
    const lookup: Record<string, MetadataTypeDto> = {};
    for (const metadataType of allMetadataTypes.value ?? []) {
        lookup[metadataType.uuid] = metadataType;
    }
    return lookup;
});

// Dynamic placeholder showing example format
const metadataPlaceholder = computed(() => {
    return "e.g. description='some description'";
});
</script>

<style scoped>
/* Finger-sized delete target on touch devices */
@media (max-width: 1023px) {
    .remove-metadata-filter {
        min-width: 40px;
        min-height: 40px;
    }
}
</style>
