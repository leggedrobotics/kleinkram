<template>
    <div class="row items-center q-gutter-x-sm full-width">
        <div class="col-5 row items-center no-wrap">
            <q-icon
                :name="
                    datatypeIcon(metadataTypeLookup[metadataTypeUuid]?.datatype)
                "
                size="20px"
                class="datatype-icon q-mr-sm"
            />
            <span class="text-weight-medium ellipsis">
                {{ metadataValues[metadataTypeUuid].name }}
            </span>
        </div>
        <div v-if="metadataTypeLookup[metadataTypeUuid]" class="col-grow">
            <q-input
                v-if="
                    metadataTypeLookup[metadataTypeUuid]?.datatype !==
                    DataType.BOOLEAN
                "
                v-model="internalValue"
                :placeholder="
                    inputPlaceholder(
                        metadataTypeLookup[metadataTypeUuid]?.datatype,
                    )
                "
                outlined
                dense
                clearable
                :type="
                    inputFieldTypeMapping(
                        metadataTypeLookup[metadataTypeUuid]?.datatype ??
                            DataType.STRING,
                    )
                "
                @clear="clearValue"
            >
                <template
                    v-if="
                        metadataTypeLookup[metadataTypeUuid]?.datatype ===
                        DataType.DATE
                    "
                    #append
                >
                    <q-icon name="sym_o_event" class="cursor-pointer" />
                </template>
                <template
                    v-else-if="
                        metadataTypeLookup[metadataTypeUuid]?.datatype ===
                        DataType.NUMBER
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
                v-if="
                    metadataTypeLookup[metadataTypeUuid]?.datatype ===
                    DataType.BOOLEAN
                "
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
import type { MetadataTypeDto } from '@kleinkram/api-dto/types/metadata/metadata.dto';
import { DataType } from '@kleinkram/shared';
import { ref, watch } from 'vue';

const properties = defineProps<{
    metadataTypeUuid: string;
    metadataTypeLookup: Record<string, MetadataTypeDto>;
    metadataValues: Record<string, { value: unknown; name: string }>;
}>();

const emit = defineEmits(['update:metadataValues']);

const internalValue = ref(
    properties.metadataValues[properties.metadataTypeUuid]?.value,
);

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
    const updatedMetadataValues = {
        ...properties.metadataValues,
        [properties.metadataTypeUuid]: {
            ...properties.metadataValues[properties.metadataTypeUuid],

            value: newValue,
        },
    };
    emit('update:metadataValues', updatedMetadataValues);
});

const clearValue = (): void => {
    const updatedMetadataValues = Object.fromEntries(
        Object.entries(properties.metadataValues).filter(
            ([key]) => key !== properties.metadataTypeUuid,
        ),
    );
    emit('update:metadataValues', updatedMetadataValues);
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
