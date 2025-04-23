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
                    <MetadataTypeTable
                        :rows="data ?? []"
                        :columns="columns"
                        :filter="tagtype"
                        @row-selected="tagTypeSelected"
                    />
                </div>
            </div>
            <div
                v-for="tagTypeUUID in Object.keys(tagValues)"
                :key="tagTypeUUID"
                class="q-mt-md row"
            >
                <MetadataFilterInput
                    :tag-type-uuid="tagTypeUUID"
                    :tag-lookup="tagLookup"
                    :tag-values="tagValues"
                    @update:tag-values="updateTagValues"
                />
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
import { TagTypeDto } from '@api/types/tags/tags.dto';
import { DataType } from '@common/enum';
import MetadataFilterInput from 'components/metadata-filter-input.vue';
import MetadataTypeTable from 'components/metadata-type-table.vue';
import { useDialogPluginComponent } from 'quasar';
import { useAllTags } from 'src/hooks/query-hooks';
import { computed, ref } from 'vue';

const { dialogRef, onDialogOK, onDialogHide } = useDialogPluginComponent();

const properties = defineProps<{
    tagValues?: Record<string, { value: any; name: string }>;
}>();

const tagtype = ref<string>('');
const tagValues = ref<Record<string, any>>({ ...properties.tagValues });

const convertedTagValues = computed(() => {
    const converted: Record<string, any> = {};
    for (const key of Object.keys(tagValues.value)) {
        const tagType = tagLookup.value[key];

        switch (tagType?.datatype) {
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
    for (const tag of data.value ?? []) {
        lookup[tag.uuid] = tag;
    }
    return lookup;
});

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

const tagTypeSelected = (row: TagTypeDto): void => {
    if (!tagValues.value.hasOwnProperty(row.uuid)) {
        tagValues.value[row.uuid] = { value: undefined, name: row.name };
    }
};

const updateTagValues = (newTagValues: Record<string, any>): void => {
    tagValues.value = newTagValues;
};

const applyAction = (): void => {
    onDialogOK(convertedTagValues);
};
</script>
