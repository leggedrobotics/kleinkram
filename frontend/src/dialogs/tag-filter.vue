<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 250px; max-width: 1500px"
        >
            <div class="q-mt-md row">
                <div class="col-4">
                    <q-input v-model="tagtype" label="Search Metadata" />
                </div>
                <div class="col-2">
                    <q-btn label="Search" color="primary" />
                </div>
            </div>
            <div class="q-mt-md row">
                <div class="col-12">
                    <q-table
                        :rows="data?.data ?? []"
                        :columns="columns as any"
                        row-key="uuid"
                        wrap-cells
                        flat
                        bordered
                        :filter="tagtype"
                        @row-click="tagTypeSelected"
                    />
                </div>
            </div>
            <div
                v-for="tagTypeUUID in Object.keys(tagValues)"
                :key="tagTypeUUID"
                class="q-mt-md row"
            >
                <div class="col-2">
                    {{ tagValues[tagTypeUUID].name }}
                </div>
                <div v-if="tagLookup[tagTypeUUID]" class="col-2">
                    <q-input
                        v-if="
                            tagLookup[tagTypeUUID].datatype !== DataType.BOOLEAN
                        "
                        v-model="tagValues[tagTypeUUID].value"
                        label="Enter Filter Value"
                        outlined
                        dense
                        clearable
                        required
                        :type="
                            // @ts-ignore
                            DataType_InputType[
                                tagLookup[tagTypeUUID].datatype
                            ] ?? 'text'
                        "
                        @clear="() => delete tagValues[tagTypeUUID]"
                    />
                    <q-toggle
                        v-if="
                            tagLookup[tagTypeUUID].datatype === DataType.BOOLEAN
                        "
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
                    <q-btn label="Apply" color="primary" @click="applyAction" />
                </div>
            </div>
        </q-card>
    </q-dialog>
</template>

<script setup lang="ts">
import { QTable, useDialogPluginComponent } from 'quasar';
import { computed, ref } from 'vue';
import { DataType } from '@common/enum';
import { TagTypeDto } from '@api/types/tags/tags.dto';
import { useAllTags } from '../hooks/query-hooks';

const { dialogRef, onDialogOK, onDialogHide } = useDialogPluginComponent();

const properties = defineProps<{
    tagValues?: Record<string, { value: any; name: string }>;
}>();

const tagtype = ref<string>('');
// @ts-ignore
const tagValues = ref<Record<string, any>>({ ...properties.tagValues } || {});

const convertedTagValues = computed(() => {
    const converted: Record<string, any> = {};
    for (const key of Object.keys(tagValues.value)) {
        const tagType = tagLookup.value[key];

        switch (tagType.datatype) {
            case DataType.BOOLEAN: {
                if (tagValues.value[key].value === undefined) {
                    break;
                }
                converted[key] = {
                    value: tagValues.value[key].value,
                    name: tagValues.value[key].name,
                };

                break;
            }
            case DataType.NUMBER: {
                if (
                    Number.isNaN(Number.parseFloat(tagValues.value[key].value))
                ) {
                    break;
                }
                converted[key] = {
                    value: Number.parseFloat(tagValues.value[key].value),
                    name: tagValues.value[key].name,
                };
                break;
            }
            case DataType.DATE: {
                if (!tagValues.value[key].value) {
                    break;
                }
                converted[key] = {
                    value: new Date(tagValues.value[key].value),
                    name: tagValues.value[key].name,
                };
                break;
            }
            default: {
                if (!tagValues.value[key].value) {
                    break;
                }
                converted[key] = {
                    value: tagValues.value[key].value,
                    name: tagValues.value[key].name,
                };
            }
        }
    }
    return converted;
});

const { data } = useAllTags();

const tagLookup = computed(() => {
    const lookup: Record<string, TagTypeDto> = {};
    for (const tag of data.value?.data ?? []) {
        lookup[tag.uuid] = tag;
    }
    return lookup;
});

const DataType_InputType = {
    [DataType.STRING]: 'text',
    [DataType.NUMBER]: 'number',
    [DataType.BOOLEAN]: 'checkbox',
    [DataType.DATE]: 'date',
    [DataType.LOCATION]: 'text',
};

function tagTypeSelected(event: any, row: TagTypeDto) {
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

const applyAction = (): void => {
    onDialogOK(convertedTagValues);
};
</script>

<style scoped></style>
