<template>
    <q-dialog ref="dialogRef" style="max-width: 1500px">
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
                        :rows="data"
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
                    {{ tagLookup[tagTypeUUID]?.name }}
                </div>
                <div class="col-2" v-if="tagLookup[tagTypeUUID]">
                    <q-input
                        v-if="tagLookup[tagTypeUUID].type !== DataType.BOOLEAN"
                        v-model="tagValues[tagTypeUUID]"
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
                        v-model="tagValues[tagTypeUUID]"
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
                        @click="() => onDialogOK(tagValues)"
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
    tagValues?: Record<string, any>;
}>();

const tagtype = ref<string>('');
const tagValues = ref<Record<string, any>>(props.tagValues || {});

const convertedTagValues = computed(() => {
    const converted: Record<string, any> = {};
    Object.keys(tagValues.value).forEach((key) => {
        const tagType = tagLookup.value[key];
        switch (tagType.type) {
            case DataType.BOOLEAN:
                converted[key] = tagValues.value[key] === 'true';
                break;
            case DataType.NUMBER:
                converted[key] = parseFloat(tagValues.value[key]);
                break;
            case DataType.DATE:
                converted[key] = new Date(tagValues.value[key]);
                break;
            default:
                converted[key] = tagValues.value[key];
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
        tagValues.value[row.uuid] = null;
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
