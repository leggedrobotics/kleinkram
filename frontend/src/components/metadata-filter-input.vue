<template>
    <div class="col-2">
        {{ tagValues[tagTypeUuid].name }}
    </div>
    <div v-if="tagLookup[tagTypeUuid]" class="col-2">
        <q-input
            v-if="tagLookup[tagTypeUuid]?.datatype !== DataType.BOOLEAN"
            v-model="internalValue"
            label="Enter Filter Value"
            outlined
            dense
            clearable
            required
            :type="
                inputFieldTypeMapping(
                    tagLookup[tagTypeUuid]?.datatype ?? DataType.STRING,
                )
            "
            @clear="clearValue"
        />
        <q-toggle
            v-if="tagLookup[tagTypeUuid]?.datatype === DataType.BOOLEAN"
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
import type { TagTypeDto } from '@kleinkram/api-dto/types/tags/tags.dto';
import { DataType } from '@kleinkram/shared';
import { defineEmits, defineProps, ref, watch } from 'vue';

const properties = defineProps<{
    tagTypeUuid: string;
    tagLookup: Record<string, TagTypeDto>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tagValues: Record<string, any>;
}>();

const emit = defineEmits(['update:tagValues']);

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        [properties.tagTypeUuid]: {
            ...properties.tagValues[properties.tagTypeUuid],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
