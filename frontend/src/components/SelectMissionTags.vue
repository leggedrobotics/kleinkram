<template>
    <q-btn-dropdown
        label="Add Tag"
        class="q-uploader--bordered full-width q-mb-lg"
        flat
        clearable
        required
        :disabled="availableAdditionalTags.length === 0"
        v-model="ddr_open2"
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
                            :name="icon(tagtype.type)"
                            style="font-size: 18px"
                        />
                    </q-item-label>
                </q-item-section>
            </q-item>
        </q-list>
    </q-btn-dropdown>

    <template
        v-for="tagtype in [...(project?.requiredTags ?? []), ...additionalTags]"
        :key="tagtype.uuid"
    >
        <div class="row">
            <div class="col-11">
                <label>
                    Tag: {{ tagtype.name }}

                    <template
                        v-if="requiredTagTypeUUIDs.includes(tagtype.uuid)"
                    >
                        *
                    </template>
                </label>
                <q-input
                    v-if="tagtype.type !== DataType.BOOLEAN"
                    v-model="localTagValues[tagtype.uuid]"
                    :placeholder="tagtype.name"
                    outlined
                    dense
                    clearable
                    required
                    style="padding-bottom: 20px"
                    :type="DataType_InputType[tagtype.type] || 'text'"
                />
                <q-field
                    v-if="tagtype.type === DataType.BOOLEAN"
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
                    v-model="localTagValues[tagtype.uuid]"
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
                        :type="DataType_InputType[tagtype.type] || 'text'"
                        :options="[
                            { label: 'True', value: true },
                            { label: 'False', value: false },
                        ]"
                    />
                </q-field>
            </div>
            <div class="col-1">
                <q-btn
                    icon="sym_o_delete"
                    round
                    flat
                    style="margin-top: 19px"
                    :disable="requiredTagTypeUUIDs.includes(tagtype.uuid)"
                    @click="removeTagType(tagtype.uuid)"
                />
            </div>
        </div>
    </template>
</template>

<script setup lang="ts">
import { DataType } from 'src/enums/TAG_TYPES';
import { ref, watch, Ref, computed } from 'vue';
import { TagType } from 'src/types/TagType';
import { Project } from 'src/types/Project';
import { useQuery } from '@tanstack/vue-query';
import { getTagTypes } from 'src/services/queries/tag';
import { getProject } from 'src/services/queries/project';
import { icon } from 'src/services/generic';
const props = defineProps<{
    tagValues: Record<string, string>;
    projectUUID: string;
}>();

const emit = defineEmits(['update:tagValues']);
const ddr_open2 = ref(false);

// Create a shallow copy of tagValues to make it editable locally
const localTagValues = ref({ ...props.tagValues });
const additionalTags: Ref<TagType[]> = ref<TagType[]>([]);

// Watch for changes in localTagValues and emit them back to the parent
watch(
    localTagValues,
    (newVal) => {
        emit('update:tagValues', newVal);
    },
    { deep: true },
);

const { data: tagTypes } = useQuery<TagType[]>({
    queryKey: ['tagTypes'],
    queryFn: getTagTypes,
});

const { data: project } = useQuery<Project>({
    queryKey: computed(() => ['project', props.projectUUID]),
    queryFn: () => getProject(props.projectUUID as string),
    enabled: computed(() => !!props.projectUUID),
});

watch(
    () => [project.value, tagTypes.value],
    ([newProject, newTagTypes]) => {
        if (newProject && newTagTypes) {
            additionalTags.value = [];
            Object.keys(localTagValues.value).forEach((tagTypeUUID) => {
                if (
                    !newProject.requiredTags
                        .map((_tagTypeUUID) => _tagTypeUUID.uuid)
                        .includes(tagTypeUUID)
                ) {
                    additionalTags.value.push(
                        newTagTypes.find(
                            (tagType) => tagType.uuid === tagTypeUUID,
                        ) as TagType,
                    );
                }
            });
        }
    },
    { immediate: true },
);

const availableAdditionalTags: Ref<TagType[]> = computed(() => {
    if (!tagTypes.value) return [];
    let usedTagUUIDs: string[] = [];
    if (project.value) {
        usedTagUUIDs = project.value.requiredTags.map((tag) => tag.uuid);
    }
    const addedTagUUIDs = additionalTags.value.map((tag) => tag.uuid);
    return tagTypes.value?.filter(
        (tagtype) =>
            !usedTagUUIDs.includes(tagtype.uuid) &&
            !addedTagUUIDs.includes(tagtype.uuid),
    );
});
const DataType_InputType = {
    [DataType.STRING]: 'text',
    [DataType.NUMBER]: 'number',
    [DataType.BOOLEAN]: 'checkbox',
    [DataType.DATE]: 'date',
    [DataType.LOCATION]: 'text',
};

function addTag(tagtype: TagType) {
    additionalTags.value.push(tagtype);
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
