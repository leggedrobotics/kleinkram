<template>
    <div class="metadata-filter-builder">
        <div
            v-if="Object.keys(localMetadataValues).length === 0"
            class="text-secondary"
        >
            No metadata filters active.
        </div>

        <div v-else class="row-grid">
            <div
                v-for="(metadataTypeUUID, index) in Object.keys(
                    localMetadataValues,
                )"
                :key="metadataTypeUUID"
                class="row-grid__row"
            >
                <div v-if="index > 0" class="row-grid__separator" />
                <MetadataFilterInput
                    :metadata-type-uuid="metadataTypeUUID"
                    :metadata-type-lookup="metadataTypeLookup"
                    :metadata-values="localMetadataValues"
                    @update:metadata-values="updateLocalMetadataValues"
                />
                <div class="row-grid__action">
                    <q-btn
                        flat
                        round
                        dense
                        icon="sym_o_delete"
                        class="row-grid__remove remove-metadata-filter"
                        :aria-label="`Remove ${localMetadataValues[metadataTypeUUID]?.name ?? 'filter'}`"
                        @click="() => removeMetadataType(metadataTypeUUID)"
                    />
                </div>
            </div>
        </div>

        <q-btn
            flat
            no-caps
            dense
            icon="sym_o_add"
            label="Add filter"
            class="text-link-primary add-button"
        >
            <q-menu
                v-model="menuOpen"
                style="min-width: 280px"
                @hide="clearSearch"
            >
                <div class="add-menu__search">
                    <q-input
                        v-model="search"
                        dense
                        outlined
                        autofocus
                        color="button-primary"
                        aria-label="Search metadata"
                        placeholder="Search metadata"
                        autocomplete="off"
                        @keydown.enter.prevent="addFirstResult"
                    >
                        <template #prepend>
                            <q-icon name="sym_o_search" />
                        </template>
                    </q-input>
                </div>
                <q-list class="add-menu__list">
                    <q-item v-if="availableMetadataTypes.length === 0">
                        <q-item-section class="text-secondary">
                            No metadata types found.
                        </q-item-section>
                    </q-item>
                    <q-item
                        v-for="metadataType in availableMetadataTypes"
                        :key="metadataType.uuid"
                        clickable
                        @click="() => addMetadataTypeFilter(metadataType)"
                    >
                        <q-item-section>
                            {{ metadataType.name }}
                        </q-item-section>
                        <q-item-section side class="add-menu__type">
                            {{ metadataType.datatype }}
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-menu>
        </q-btn>
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
const menuOpen = ref(false);
const search = ref('');

const clearSearch = (): void => {
    search.value = '';
};

/** Metadata types not filtered yet, matching the search, one per name */
const availableMetadataTypes = computed<MetadataTypeDto[]>(() => {
    const needle = search.value.toLowerCase();
    const seenNames = new Set<string>();
    const unique: MetadataTypeDto[] = [];
    for (const metadataType of allMetadataTypes.value ?? []) {
        if (
            !localMetadataValues.value[metadataType.uuid] &&
            metadataType.name.toLowerCase().includes(needle) &&
            !seenNames.has(metadataType.name)
        ) {
            unique.push(metadataType);
            seenNames.add(metadataType.name);
        }
    }
    return unique;
});

/** Enter in the search adds the first match */
const addFirstResult = (): void => {
    const first = availableMetadataTypes.value[0];
    if (first) addMetadataTypeFilter(first);
};

function addMetadataTypeFilter(selectedMetadataType: MetadataTypeDto) {
    if (!allMetadataTypes.value) return;
    menuOpen.value = false;

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
}

// Metadata Type Lookup for the Input Component
const metadataTypeLookup = computed(() => {
    const lookup: Record<string, MetadataTypeDto> = {};
    for (const metadataType of allMetadataTypes.value ?? []) {
        lookup[metadataType.uuid] = metadataType;
    }
    return lookup;
});
</script>

<style scoped>
/* the datatype, right-aligned: small monospace $text-secondary */
.add-menu__type {
    color: #525252;
    font-family: monospace;
    font-size: 11px;
    text-transform: uppercase;
}

/* rows share their columns: name | value | remove */
.row-grid {
    display: grid;
    grid-template-columns: minmax(100px, 200px) minmax(0, 1fr) 32px;
    gap: 8px 16px;
    align-items: center;
}

.row-grid__row {
    display: contents;
}

/* $border-subtle-00 */
.row-grid__separator {
    grid-column: 1 / -1;
    height: 1px;
    background: #e0e0e0;
}

.row-grid__action {
    display: flex;
    justify-content: center;
}

/* $icon-secondary */
.row-grid__remove {
    color: #525252;
}

.add-button {
    margin-top: 8px;
}

.add-menu__search {
    padding: 8px;
}

.add-menu__list {
    max-height: 320px;
    overflow-y: auto;
}

/* Finger-sized delete target on touch devices */
@media (max-width: 1023px) {
    .remove-metadata-filter {
        min-width: 40px;
        min-height: 40px;
    }
}

@media (max-width: 599px) {
    .row-grid {
        grid-template-columns: minmax(0, 1fr) 40px;
    }

    .row-grid :deep(.filter-cells__name) {
        grid-column: 1 / -1;
        margin-top: 8px;
    }
}
</style>
