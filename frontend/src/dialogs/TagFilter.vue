<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 250px; max-width: 1500px"
        >
            <div class="q-mt-md row">
                <div class="col-4">
                    <q-input v-model="tagtype" label="Search Tag Type" />
                </div>
                <div class="col-2">
                    <q-btn label="Search" color="primary" />
                </div>
            </div>
            <div class="q-mt-md row">
                <div class="col-12">
                    <q-table
                        :rows="data || []"
                        :columns="columns"
                        row-key="uuid"
                        wrap-cells
                        flat
                        bordered
                        @rowClick="tagTypeSelected"
                        :filter="tagtype"
                    />
                </div>
            </div>
            <div
                class="q-mt-md row"
                v-for="tagTypeUUID in Object.keys(tagValues)"
            >
                <div class="col-2">
                    {{ tagValues[tagTypeUUID].name }}
                </div>
                <div class="col-2" v-if="tagLookup[tagTypeUUID]">
                    <q-input
                        v-if="tagLookup[tagTypeUUID].type !== DataType.BOOLEAN"
                        v-model="tagValues[tagTypeUUID].value"
                        label="Enter Filter Value"
                        outlined
                        dense
                        clearable
                        required
                        @clear="delete tagValues[tagTypeUUID]"
                        :type="
                            DataType_InputType[tagLookup[tagTypeUUID].type] ||
                            'text'
                        "
                    />
                    <q-toggle
                        v-if="tagLookup[tagTypeUUID].type === DataType.BOOLEAN"
                        v-model="tagValues[tagTypeUUID].value"
                        :label="
                            tagValues[tagTypeUUID] === undefined
                                ? '-'
                                : tagValues[tagTypeUUID]
                                  ? 'True'
                                  : 'False'
                        "
                        outlined
                        dense
                        required
                        flat
                        style="width: 100%"
                        :options="[
                            { label: 'True', value: true },
                            { label: 'False', value: false },
                        ]"
                    />
                </div>
            </div>
            <div class="q-mt-md row">
                <div class="col-10" />
                <div class="col-1">
                    <q-btn label="Close" color="orange" @click="onDialogHide" />
                </div>
                <div class="col-1">
                    <q-btn
                        label="Apply"
                        color="primary"
                        @click="() => onDialogOK(convertedTagValues)"
                    />
                </div>
            </div>
        </q-card>
    </q-dialog>
</template>

<script setup lang="ts">
import { QTable, useDialogPluginComponent } from 'quasar';
import { computed, Ref, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { TagType } from 'src/types/TagType';
import { getFilteredTagTypes, getTagTypes } from 'src/services/queries/tag';
import { DataType } from 'src/enums/TAG_TYPES';

const { dialogRef, onDialogOK, onDialogHide } = useDialogPluginComponent();

const props = defineProps<{
    tagValues?: Record<string, { value: any; name: string }>;
}>();

const tagtype = ref<string>('');
const tagValues = ref<Record<string, any>>({ ...props.tagValues } || {});

const convertedTagValues = computed(() => {
    const converted: Record<string, any> = {};
    Object.keys(tagValues.value).forEach((key) => {
        const tagType = tagLookup.value[key];

        switch (tagType.type) {
            case DataType.BOOLEAN:
                if (tagValues.value[key].value === undefined) {
                    break;
                }
                converted[key] = {
                    value: tagValues.value[key].value,
                    name: tagValues.value[key].name,
                };

                break;
            case DataType.NUMBER:
                if (isNaN(parseFloat(tagValues.value[key].value))) {
                    break;
                }
                converted[key] = {
                    value: parseFloat(tagValues.value[key].value),
                    name: tagValues.value[key].name,
                };
                break;
            case DataType.DATE:
                if (!tagValues.value[key].value) {
                    break;
                }
                converted[key] = {
                    value: new Date(tagValues.value[key].value),
                    name: tagValues.value[key].name,
                };
                break;
            default:
                if (!tagValues.value[key].value) {
                    break;
                }
                converted[key] = {
                    value: tagValues.value[key].value,
                    name: tagValues.value[key].name,
                };
        }
    });
    return converted;
});

const { data } = useQuery<TagType[]>({
    queryKey: ['tagTypes'],
    queryFn: getTagTypes,
});

const tagLookup = computed(() => {
    const lookup: Record<string, TagType> = {};
    data.value?.forEach((tag) => {
        lookup[tag.uuid] = tag;
    });
    return lookup;
});

const DataType_InputType = {
    [DataType.STRING]: 'text',
    [DataType.NUMBER]: 'number',
    [DataType.BOOLEAN]: 'checkbox',
    [DataType.DATE]: 'date',
    [DataType.LOCATION]: 'text',
};

function tagTypeSelected(event: any, row: TagType) {
    if (!tagValues.value.hasOwnProperty(row.uuid)) {
        tagValues.value[row.uuid] = { value: undefined, name: row.name };
    }
}

const columns = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        field: 'name',
    },
    {
        name: 'datatype',
        required: true,
        label: 'Datatype',
        align: 'left',
        field: 'type',
    },
];
</script>

<style scoped></style>
