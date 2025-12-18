<template>
    <div class="row items-center q-gutter-x-sm full-width">
        <div class="col-5 row items-center no-wrap">
            <q-icon
                :name="datatypeIcon(tagLookup[tagTypeUuid]?.datatype)"
                size="20px"
                class="datatype-icon q-mr-sm"
            />
            <span class="text-weight-medium ellipsis">
                {{ tagValues[tagTypeUuid].name }}
            </span>
        </div>
        <div v-if="tagLookup[tagTypeUuid]" class="col-grow">
            <q-input
                v-if="tagLookup[tagTypeUuid]?.datatype !== DataType.BOOLEAN"
                v-model="internalValue"
                :placeholder="
                    inputPlaceholder(tagLookup[tagTypeUuid]?.datatype)
                "
                outlined
                dense
                clearable
                :type="
                    inputFieldTypeMapping(
                        tagLookup[tagTypeUuid]?.datatype ?? DataType.STRING,
                    )
                "
                @clear="clearValue"
            >
                <template
                    v-if="tagLookup[tagTypeUuid]?.datatype === DataType.DATE"
                    #append
                >
                    <q-icon name="sym_o_event" class="cursor-pointer" />
                </template>
                <template
                    v-else-if="
                        tagLookup[tagTypeUuid]?.datatype === DataType.NUMBER
                    "
                    #append
                >
                    <div
                        class="column items-center justify-center q-gutter-y-none"
                        style="font-size: 10px"
                    >
                        <q-icon
                            name="sym_o_expand_less"
                            size="12px"
                            class="cursor-pointer"
                            @click="incrementValue"
                        />
                        <q-icon
                            name="sym_o_expand_more"
                            size="12px"
                            class="cursor-pointer"
                            @click="decrementValue"
                        />
                    </div>
                </template>
            </q-input>
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
                dense
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import type { TagTypeDto } from '@kleinkram/api-dto/types/tags/tags.dto';
import { DataType } from '@kleinkram/shared';
import { ref, watch } from 'vue';

const properties = defineProps<{
    tagTypeUuid: string;
    tagLookup: Record<string, TagTypeDto>;
    tagValues: Record<string, { value: unknown; name: string }>;
}>();

const emit = defineEmits(['update:tagValues']);

const internalValue = ref(properties.tagValues[properties.tagTypeUuid]?.value);

const datatypeIcon = (datatype: DataType | undefined): string => {
    switch (datatype) {
        case DataType.STRING: {
            return 'sym_o_description';
        }
        case DataType.NUMBER: {
            return 'sym_o_tag';
        }
        case DataType.BOOLEAN: {
            return 'sym_o_check_box';
        }
        case DataType.DATE: {
            return 'sym_o_event';
        }
        case DataType.LOCATION: {
            return 'sym_o_place';
        }
        case DataType.LINK: {
            return 'sym_o_link';
        }
        default: {
            return 'sym_o_label';
        }
    }
};

const inputPlaceholder = (datatype: DataType | undefined): string => {
    switch (datatype) {
        case DataType.NUMBER: {
            return '0';
        }
        case DataType.DATE: {
            return 'dd.mm.yyyy';
        }
        default: {
            return 'Enter value...';
        }
    }
};

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

const incrementValue = (): void => {
    const currentValue = Number(internalValue.value) || 0;
    internalValue.value = currentValue + 1;
};

const decrementValue = (): void => {
    const currentValue = Number(internalValue.value) || 0;
    internalValue.value = currentValue - 1;
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

<style scoped>
.datatype-icon {
    border: 1.5px solid currentColor;
    border-radius: 4px;
    padding: 2px;
    color: #616161;
}
</style>
