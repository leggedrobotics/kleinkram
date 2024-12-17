<template>
    <q-btn-dropdown
        v-model="ddr_open2"
        label="Add Tag"
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
                        <q-chip square>{{ tagtype.datatype }}</q-chip>
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
        <div
            style="
                display: flex;
                flex-direction: row;
                flex-align: bottom;
                justify-content: left;
                margin-bottom: 20px;
            "
        >
            <div style="display: flex; width: 200px">
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
            <div style="display: flex; flex-direction: row; flex-grow: 2">
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
                    style="padding-bottom: 20px"
                >
                    <q-toggle
                        v-model="localTagValues[tagtype.uuid]"
                        :label="
                            localTagValues[tagtype.uuid] === undefined
                                ? '-'
                                : localTagValues[tagtype.uuid]
                                  ? 'True'
                                  : 'False'
                        "
                        outlined
                        dense
                        required
                        flat
                        style="padding-bottom: 30px"
                        :type="DataType_InputType[tagtype.datatype] || 'text'"
                        :options="[
                            { label: 'True', value: true },
                            { label: 'False', value: false },
                        ]"
                    />
                </q-field>

                <q-btn
                    icon="sym_o_delete"
                    :color="tagColor(tagtype)"
                    round
                    flat
                    style="flex-grow: 1"
                    :disable="isRequired(tagtype)"
                    @click="() => removeTagType(tagtype.uuid)"
                >
                    <q-tooltip v-if="isRequired(tagtype)"
                        >Can't delete Tags that are required!
                    </q-tooltip>
                </q-btn>
            </div>
        </div>
    </template>
</template>

<script setup lang="ts">
import { computed, Ref, ref, watch } from 'vue';
import { DataType } from '@common/enum';
import { TagDto, TagTypeDto } from '@api/types/tags/tags.dto';
import { useAllTags, useProjectQuery } from '../hooks/query-hooks';

const properties = defineProps<{
    tagValues: Record<string, string>;
    projectUuid: string;
}>();

const emit = defineEmits(['update:tagValues']);
const ddr_open2 = ref(false);

// Create a shallow copy of tagValues to make it editable locally
const localTagValues = ref({ ...properties.tagValues });
const additionalTags: Ref<TagTypeDto[]> = ref<TagTypeDto[]>([]);

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
    () => [project.value, tagTypes.value],
    ([newProject, newTagTypes]) => {
        if (newProject && newTagTypes) {
            additionalTags.value = [];
            for (const tagTypeUUID of Object.keys(localTagValues.value)) {
                if (
                    // @ts-ignore
                    !newProject.requiredTags
                        // @ts-ignore
                        ?.map((_tagTypeUUID) => _tagTypeUUID.uuid)
                        .includes(tagTypeUUID)
                ) {
                    const newTag: TagDto | undefined = newTagTypes.data.find(
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
    if (tagTypes.value.data === undefined) return [];
    const addedTagUUIDs = new Set(additionalTags.value.map((tag) => tag.uuid));
    return tagTypes.value.data.filter(
        (tagtype: TagTypeDto) =>
            !usedTagUUIDs.includes(tagtype.uuid) &&
            !addedTagUUIDs.has(tagtype.uuid),
    );
});
const DataType_InputType = {
    [DataType.STRING]: 'text',
    [DataType.NUMBER]: 'number',
    [DataType.BOOLEAN]: 'checkbox',
    [DataType.DATE]: 'date',
    [DataType.LOCATION]: 'text',
};

function addTag(tagtype: TagTypeDto) {
    additionalTags.value.push(tagtype);
}

function tagColor(tagtype: TagTypeDto) {
    return isRequired(tagtype) ? 'grey' : 'black';
}

function isRequired(tagtype: TagTypeDto) {
    if (requiredTagTypeUUIDs.value) {
        const requiredTags = requiredTagTypeUUIDs.value;
        return requiredTags.includes(tagtype.uuid);
    } else {
        return true;
    }
}

const requiredTagTypeUUIDs = computed(() =>
    project.value?.requiredTags.map((tag) => tag.uuid),
);

function removeTagType(tagtypeUUID: string) {
    const index = additionalTags.value.findIndex(
        (tagtype) => tagtype.uuid === tagtypeUUID,
    );
    if (index !== -1) {
        additionalTags.value.splice(index, 1);
    }
}
</script>
<style scoped>
.tag-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
</style>
