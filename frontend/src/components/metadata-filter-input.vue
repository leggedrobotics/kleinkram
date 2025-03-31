<template>
    <div class="col-2">
        {{ tagValues[tagTypeUuid].name }}
    </div>
    <div v-if="tagLookup[tagTypeUuid]" class="col-2">
        <q-input
            v-if="tagLookup[tagTypeUuid].datatype !== DataType.BOOLEAN"
            v-model="internalValue"
            label="Enter Filter Value"
            outlined
            dense
            clearable
            required
            :type="inputFieldTypeMapping(tagLookup[tagTypeUuid].datatype)"
            @clear="clearValue"
        />
        <q-toggle
            v-if="tagLookup[tagTypeUuid].datatype === DataType.BOOLEAN"
            v-model="internalValue"
            :label="
                internalValue === undefined
                    ? '-'
                    : internalValue
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
</template>

<script setup lang="ts">
import { defineEmits, defineProps, ref, watch } from 'vue';
import { DataType } from '@common/enum';
import { TagTypeDto } from '@api/types/tags/tags.dto';

const properties = defineProps<{
    tagTypeUuid: string;
    tagLookup: Record<string, TagTypeDto>;
    tagValues: Record<string, any>;
}>();

const emit = defineEmits(['update:tagValues']);

const internalValue = ref(properties.tagValues[properties.tagTypeUuid]?.value);

const inputFieldTypeMapping = (datatype: DataType) => {
    switch (datatype) {
        case DataType.NUMBER: {
            return 'number';
        }
        case DataType.DATE: {
            return 'date';
        }
        default: {
            return 'text';
        }
    }
};

watch(internalValue, (newValue) => {
    const updatedTagValues = {
        ...properties.tagValues,
        [properties.tagTypeUuid]: {
            ...properties.tagValues[properties.tagTypeUuid],
            value: newValue,
        },
    };
    emit('update:tagValues', updatedTagValues);
});

const clearValue = (): void => {
    const updatedTagValues = Object.fromEntries(
        Object.entries(properties.tagValues).filter(
            ([key]) => key !== properties.tagTypeUuid,
        ),
    );
    emit('update:tagValues', updatedTagValues);
};
</script>
