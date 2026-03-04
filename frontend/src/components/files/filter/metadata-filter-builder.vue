<template>
    <div class="metadata-filter-builder column q-gutter-y-md">
        <!-- Add New Metadata Filter -->
        <div class="row q-gutter-x-sm items-center">
            <div class="col-grow">
                <q-select
                    v-model="selectedTagToAdd"
                    :options="filteredTags"
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
                    @filter="filterTags"
                    @update:model-value="addTagFilter"
                >
                    <template #no-option>
                        <q-item>
                            <q-item-section class="text-grey">
                                No metadata tags found.
                            </q-item-section>
                        </q-item>
                    </template>
                </q-select>
            </div>
        </div>

        <!-- Active Metadata Filters -->
        <div
            v-if="Object.keys(localTagValues).length === 0"
            class="text-grey-6 text-center q-pa-sm"
        >
            No metadata filters active.
        </div>

        <div v-else class="column q-gutter-y-sm">
            <div
                v-for="tagTypeUUID in Object.keys(localTagValues)"
                :key="tagTypeUUID"
                class="row items-start q-gutter-x-sm bg-grey-1 q-pa-sm rounded-borders"
            >
                <div class="col-grow">
                    <MetadataFilterInput
                        :tag-type-uuid="tagTypeUUID"
                        :tag-lookup="tagLookup"
                        :tag-values="localTagValues"
                        @update:tag-values="updateLocalTagValues"
                    />
                </div>
                <div class="col-auto">
                    <q-btn
                        flat
                        dense
                        icon="sym_o_close"
                        color="negative"
                        @click="() => removeTag(tagTypeUUID)"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { TagTypeDto } from '@kleinkram/api-dto/types/tags/tags.dto';
import MetadataFilterInput from 'components/metadata-filter-input.vue';
import { useAllTags } from 'src/hooks/query-hooks';
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

const { data: allTags } = useAllTags();

// Local state to manage the UI before emitting
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const localTagValues = ref<Record<string, { value: any; name: string }>>({});

watch(
    () => props.modelValue,
    (value) => {
        // Deep sync needed to keep local state consistent with props
        localTagValues.value = { ...value };
    },
    { immediate: true, deep: true },
);

function updateLocalTagValues(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newVals: Record<string, { value: any; name: string }>,
) {
    localTagValues.value = newVals;
    emit('update:modelValue', localTagValues.value);
}

function removeTag(uuid: string) {
    const { [uuid]: _removed, ...rest } = localTagValues.value;
    updateLocalTagValues(rest);
}

// --- Tag Search ---
const selectedTagToAdd = ref<TagTypeDto | null>(null);
const filteredTags = ref<TagTypeDto[]>([]);

function filterTags(value: string, update: (function_: () => void) => void) {
    if (!allTags.value) {
        update(() => {
            filteredTags.value = [];
        });
        return;
    }
    update(() => {
        const needle = value.toLowerCase();
        // available = all tags NOT yet in localTagValues
        const available = allTags.value.filter(
            (t) => !localTagValues.value[t.uuid],
        );

        // Deduplicate suggestions by name
        const seenNames = new Set<string>();
        const uniqueTags: TagTypeDto[] = [];

        for (const tag of available) {
            if (
                tag.name.toLowerCase().includes(needle) &&
                !seenNames.has(tag.name)
            ) {
                uniqueTags.push(tag);
                seenNames.add(tag.name);
            }
        }

        filteredTags.value = uniqueTags;
    });
}

function addTagFilter(selectedTag: TagTypeDto | null) {
    if (!selectedTag || !allTags.value) return;

    // We must use a new object reference to trigger reactivity
    const newVals = { ...localTagValues.value };

    // Find ALL tags with the same name as the selected one (ignoring case)
    const matchingTags = allTags.value.filter(
        (t) => t.name.toLowerCase() === selectedTag.name.toLowerCase(),
    );

    // Add all of them
    for (const tag of matchingTags) {
        // Initialize with empty value if not already present
        newVals[tag.uuid] ??= { name: tag.name, value: undefined };
    }

    updateLocalTagValues(newVals);

    // Reset input
    selectedTagToAdd.value = null;
}

// Tag Lookup for the Input Component
const tagLookup = computed(() => {
    const lookup: Record<string, TagTypeDto> = {};
    for (const tag of allTags.value ?? []) {
        lookup[tag.uuid] = tag;
    }
    return lookup;
});

// Dynamic placeholder showing example format
const metadataPlaceholder = computed(() => {
    return "e.g. description='some description'";
});
</script>
