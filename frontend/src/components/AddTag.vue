<template>
    <div class="row flex-center flex">
        <h4>Add Tags</h4>
    </div>
    <q-form @submit="() => save()">
        <div class="row">
            <div class="col-3">
                <q-btn-dropdown label="Add another tag">
                    <q-list>
                        <q-item
                            v-for="tagtype in availableAdditionalTags"
                            :key="tagtype.uuid"
                            clickable
                            @click="() => addTag(tagtype)"
                        >
                            <q-item-section>
                                <q-item-label>
                                    {{ tagtype.name }}
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
            </div>
            <div class="col-8" />
            <div class="col-1">
                <q-btn
                    label="Save"
                    color="primary"
                    type="submit"
                    :disable="additonalTags.length === 0"
                />
            </div>
        </div>

        <div
            v-for="tagtype in additonalTags"
            :key="tagtype.uuid"
            class="row q-gutter-sm"
        >
            <div class="col-3">
                <div class="text-bold q-pa-md" style="width: 100%">
                    {{ tagtype.name }}
                </div>
            </div>
            <div class="col-3">
                <q-input
                    v-if="tagtype.type !== DataType.BOOLEAN"
                    v-model="tagValues[tagtype.uuid]"
                    :label="tagtype.name"
                    outlined
                    dense
                    clearable
                    required
                    :type="DataType_InputType[tagtype.type] || 'text'"
                    style="width: 100%"
                />
                <q-field
                    v-if="tagtype.type === DataType.BOOLEAN"
                    v-model="tagValues[tagtype.uuid]"
                    :rules="[
                        (val) =>
                            val === true ||
                            val === false ||
                            'Please select a value',
                    ]"
                    style="width: 100%"
                    color="black"
                    dense
                    outlined
                >
                    <q-toggle
                        v-model="tagValues[tagtype.uuid]"
                        :label="
                            tagValues[tagtype.uuid] === undefined
                                ? '-'
                                : tagValues[tagtype.uuid]
                                  ? 'True'
                                  : 'False'
                        "
                        outlined
                        dense
                        required
                        flat
                        :type="DataType_InputType[tagtype.type] || 'text'"
                        style="width: 100%"
                        :options="[
                            { label: 'True', value: true },
                            { label: 'False', value: false },
                        ]"
                    />
                </q-field>
            </div>
        </div>
    </q-form>
</template>
<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, ref, Ref } from 'vue';
import { Notify } from 'quasar';
import { getMission } from 'src/services/queries/mission';
import { getTagTypes } from 'src/services/queries/tag';
import { addTags } from 'src/services/mutations/tag';
import { DataType } from '@common/enum';

const queryClient = useQueryClient();

const props = defineProps<{
    mission_uuid: string;
}>();

const { data } = useQuery<Mission>({
    queryKey: ['mission', props.mission_uuid],
    queryFn: () => getMission(props.mission_uuid),
    enabled: !!props.mission_uuid,
});

const { data: tagTypes } = useQuery<TagType[]>({
    queryKey: ['tagTypes'],
    queryFn: getTagTypes,
});
const tagValues: Ref<Record<string, string>> = ref({});
const DataType_InputType = {
    [DataType.STRING]: 'text',
    [DataType.NUMBER]: 'number',
    [DataType.BOOLEAN]: 'checkbox',
    [DataType.DATE]: 'date',
    [DataType.LOCATION]: 'text',
};

const additonalTags: Ref<TagType[]> = ref<TagType[]>([]);

const availableAdditionalTags: Ref<TagType[]> = computed(() => {
    if (!tagTypes.value) return [];
    const usedTagUUIDs = data.value
        ? data.value.tags.map((tag) => tag.type.uuid)
        : [];
    const addedTagUUIDs = additonalTags.value.map((tag) => tag.uuid);
    return tagTypes.value.filter(
        (tagtype) =>
            !usedTagUUIDs.includes(tagtype.uuid) &&
            !addedTagUUIDs.includes(tagtype.uuid),
    );
});

function addTag(tagtype: TagType) {
    additonalTags.value.push(tagtype);
}

const { mutate: save } = useMutation({
    mutationFn: () => addTags(props.mission_uuid, tagValues.value),
    async onSuccess() {
        Notify.create({
            message: 'Tags saved',
            color: 'positive',
            position: 'bottom',
        });
        const cache = queryClient.getQueryCache();
        const filtered = cache
            .getAll()
            .filter(
                (query) =>
                    query.queryKey[0] === 'mission' &&
                    query.queryKey[1] === props.mission_uuid,
            );
        await Promise.all(
            filtered.map((query) =>
                queryClient.invalidateQueries(query.queryKey),
            ),
        );
    },
    onError(error) {
        console.log(error);
    },
});
</script>

<style scoped></style>
