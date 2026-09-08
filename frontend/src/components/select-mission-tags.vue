<template>
    <q-btn-dropdown
        v-model="ddr_open2"
        label="Add Optional Metadata"
        class="q-uploader--bordered full-width q-mb-lg"
        flat
        clearable
        required
        :disabled="availableAdditionalTags.length === 0"
    >
        <q-tooltip v-if="availableAdditionalTags.length === 0">
            All available tags types have been added.
        </q-tooltip>
        <q-list>
            <q-item
                v-for="tagtype in availableAdditionalTags"
                :key="tagtype.uuid"
                clickable
                @click="
                    () => {
                        addTag(tagtype);
                        ddr_open2 = false;
                    }
                "
            >
                <q-item-section>
                    <q-item-label class="tag-label">
                        <span>{{ tagtype.name }}</span>
                        <q-icon
                            v-if="tagtype.datatype"
                            :name="icon(tagtype.datatype)"
                            class="q-ml-sm"
                        >
                            <q-tooltip>
                                Metadata of Type {{ tagtype.datatype }}
                            </q-tooltip>
                        </q-icon>
                    </q-item-label>
                </q-item-section>
            </q-item>
        </q-list>
    </q-btn-dropdown>

    <template
        v-for="tagtype in [
            ...(project?.requiredTags ?? []),
            ...additionalTags,
        ] as TagTypeDto[]"
        :key="tagtype.uuid"
    >
        <div class="tag-row">
            <div class="tag-row__label">
                <label style="align-self: center">
                    {{ tagtype.name }}

                    <template
                        v-if="requiredTagTypeUUIDs?.includes(tagtype.uuid)"
                    >
                        *
                    </template>
                </label>
                <q-chip square style="align-self: center">
                    {{ tagtype.datatype }}
                </q-chip>
            </div>

            <div class="tag-row__input">
                <q-input
                    v-if="tagtype.datatype !== DataType.BOOLEAN"
                    v-model="localTagValues[tagtype.uuid]"
                    :placeholder="tagtype.name"
                    outlined
                    dense
                    required
                    style="flex-grow: 3"
                    :type="
                        // @ts-ignore
                        DataType_InputType[tagtype.datatype] ?? 'text'
                    "
                />
                <q-field
                    v-if="tagtype.datatype === DataType.BOOLEAN"
                    v-model="localTagValues[tagtype.uuid]"
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
                        v-model="localTagValues[tagtype.uuid]"
                        :label="
                            localTagValues[tagtype.uuid] === undefined
                                ? 'Click toggle to define value'
                                : localTagValues[tagtype.uuid]
                                  ? 'True'
                                  : 'False'
                        "
                        outlined
                        dense
                        required
                        flat
                        style=""
                        :type="DataType_InputType[tagtype.datatype] || 'text'"
                        :options="[
                            { label: 'True', value: true },
                            { label: 'False', value: false },
                        ]"
                    />
                </q-field>

                <q-btn
                    icon="sym_o_delete"
                    class="text-red"
                    :color="tagColor(tagtype)"
                    round
                    flat
                    style="flex-grow: 1"
                    :disable="isRequired(tagtype)"
                    @click="() => removeTagType(tagtype.uuid)"
                >
                    <q-tooltip v-if="isRequired(tagtype)">
                        You cannot delete enforced metadata.
                    </q-tooltip>
                </q-btn>
            </div>
        </div>
    </template>
</template>

<script setup lang="ts">
import type { TagTypeDto } from '@kleinkram/api-dto/types/tags/tags.dto';
import { DataType } from '@kleinkram/shared';
import { useAllTags, useProjectQuery } from 'src/hooks/query-hooks';
import { icon } from 'src/services/generic';
import { computed, Ref, ref, watch } from 'vue';

const properties = defineProps<{
    tagValues: Record<string, string>;
    projectUuid: string;
}>();

const emit = defineEmits(['update:tagValues']);

// eslint-disable-next-line @typescript-eslint/naming-convention
const ddr_open2 = ref(false);

// Create a shallow copy of tagValues to make it editable locally
const localTagValues = ref({ ...properties.tagValues });
const additionalTags: Ref<TagTypeDto[]> = ref<TagTypeDto[]>([]);

// Keep local copy in sync with prop changes from parent
watch(
    () => properties.tagValues,
    (newValue) => {
        const isDifferent =
            JSON.stringify(newValue) !== JSON.stringify(localTagValues.value);
        if (isDifferent) {
            localTagValues.value = { ...newValue };
        }
    },
    { deep: true, immediate: true },
);

// Watch for changes in localTagValues and emit them back to the parent
watch(
    localTagValues,
    (newValue) => {
        emit('update:tagValues', newValue);
    },
    { deep: true },
);

const { data: tagTypes } = useAllTags();
const { data: project } = useProjectQuery(
    computed(() => properties.projectUuid),
);

watch(
    () => ({
        project: project.value,
        tagTypes: tagTypes.value,
        tagKeys: Object.keys(localTagValues.value).join(','),
    }),
    ({ project: newProject, tagTypes: newTagTypes }) => {
        if (newProject && newTagTypes) {
            additionalTags.value = [];
            for (const tagTypeUUID of Object.keys(localTagValues.value)) {
                if (
                    !newProject.requiredTags
                        .map((_tagTypeUUID: TagTypeDto) => _tagTypeUUID.uuid)
                        .includes(tagTypeUUID)
                ) {
                    const newTag: TagTypeDto | undefined = newTagTypes.find(
                        (tagType: TagTypeDto) => tagType.uuid === tagTypeUUID,
                    );
                    if (newTag === undefined) continue;
                    additionalTags.value.push(newTag);
                }
            }
        }
    },
    { immediate: true },
);

const availableAdditionalTags: Ref<TagTypeDto[]> = computed(() => {
    if (tagTypes.value === undefined) return [];
    let usedTagUUIDs: string[] = [];
    if (project.value) {
        usedTagUUIDs = project.value.requiredTags.map((tag) => tag.uuid);
    }
    const addedTagUUIDs = new Set(additionalTags.value.map((tag) => tag.uuid));
    return tagTypes.value.filter(
        (metadataType: TagTypeDto) =>
            !usedTagUUIDs.includes(metadataType.uuid) &&
            !addedTagUUIDs.has(metadataType.uuid),
    );
});
// eslint-disable-next-line @typescript-eslint/naming-convention
const DataType_InputType = {
    [DataType.STRING]: 'text',
    [DataType.NUMBER]: 'number',
    [DataType.BOOLEAN]: 'checkbox',
    [DataType.DATE]: 'date',
    [DataType.LOCATION]: 'text',
};

const addTag = (metadataType: TagTypeDto): void => {
    additionalTags.value.push(metadataType);
    if (!(metadataType.uuid in localTagValues.value)) {
        // Use undefined for BOOLEAN so that the toggle starts in the neutral/undefined state
        localTagValues.value[metadataType.uuid] =
            metadataType.datatype === DataType.BOOLEAN
                ? (undefined as unknown as string)
                : '';
    }
};

const tagColor = (metadataType: TagTypeDto): string => {
    return isRequired(metadataType) ? 'grey' : 'black';
};

const isRequired = (metadataType: TagTypeDto): boolean => {
    if (requiredTagTypeUUIDs.value) {
        const requiredTags = requiredTagTypeUUIDs.value;
        return requiredTags.includes(metadataType.uuid);
    } else {
        return true;
    }
};

const requiredTagTypeUUIDs = computed(() =>
    project.value?.requiredTags.map((tag) => tag.uuid),
);

const removeTagType = (metadataTypeUUID: string): void => {
    const index = additionalTags.value.findIndex(
        (metadataType) => metadataType.uuid === metadataTypeUUID,
    );
    if (index !== -1) {
        additionalTags.value.splice(index, 1);
    }
    const { [metadataTypeUUID]: _, ...rest } = localTagValues.value;
    localTagValues.value = rest;
};
</script>
<style scoped>
.tag-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.tag-row {
    display: flex;
    flex-direction: row;
    justify-content: left;
    margin-bottom: 20px;
}

.tag-row__label {
    display: flex;
    width: 200px;
    flex: 0 0 auto;
}

.tag-row__input {
    display: flex;
    flex-direction: row;
    flex-grow: 2;
    min-width: 0;
}

@media (max-width: 599px) {
    .tag-row {
        flex-direction: column;
        gap: 4px;
        margin-bottom: 16px;
    }

    .tag-row__label {
        width: 100%;
    }
}
</style>
