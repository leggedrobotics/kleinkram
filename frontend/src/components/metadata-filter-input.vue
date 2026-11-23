<template>
    <div class="filter-cells">
        <div class="filter-cells__name">
            <div class="filter-cells__label">
                {{ metadataValues[metadataTypeUuid]?.name }}
            </div>
            <div class="filter-cells__type">
                {{ metadataTypeLookup[metadataTypeUuid]?.datatype }}
            </div>
        </div>
        <div class="filter-cells__input">
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
                :aria-label="metadataValues[metadataTypeUuid]?.name"
                outlined
                dense
                color="button-primary"
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
            <div
                v-if="
                    metadataTypeLookup[metadataTypeUuid]?.datatype ===
                    DataType.BOOLEAN
                "
                role="radiogroup"
                :aria-label="metadataValues[metadataTypeUuid]?.name"
                class="boolean-choice"
            >
                <q-btn
                    v-for="choice in [true, false]"
                    :key="String(choice)"
                    flat
                    no-caps
                    dense
                    role="radio"
                    :aria-checked="internalValue === choice"
                    :label="choice ? 'True' : 'False'"
                    class="boolean-choice__option"
                    :class="{
                        'boolean-choice__option--selected':
                            internalValue === choice,
                    }"
                    @click="() => toggleBoolean(choice)"
                />
            </div>
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

const inputPlaceholder = (datatype: DataType | undefined): string => {
    switch (datatype) {
        case DataType.NUMBER: {
            return '0';
        }
        case DataType.DATE: {
            return 'dd.mm.yyyy';
        }
        default: {
            return '';
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

/** Picks True or False; picking the selected one clears the filter value */
const toggleBoolean = (choice: boolean): void => {
    internalValue.value = internalValue.value === choice ? undefined : choice;
};

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
/* the cells take part in the grid of metadata-filter-builder */
.filter-cells {
    display: contents;
}

.filter-cells__name {
    min-width: 0;
    overflow-wrap: anywhere;
}

/* $text-primary */
.filter-cells__label {
    color: #161616;
    font-size: 14px;
    line-height: 18px;
}

/* $text-secondary */
.filter-cells__type {
    color: #525252;
    font-family: monospace;
    font-size: 11px;
    line-height: 16px;
    text-transform: uppercase;
}

.filter-cells__input {
    min-width: 0;
}

/* True / False choice: like the expiration chips, selected is $button-secondary */
.boolean-choice {
    display: flex;
    gap: 8px;
}

.boolean-choice__option {
    min-width: 72px;
    height: 40px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: #eeeeee;
    color: #161616;
}

.boolean-choice__option--selected {
    border-color: #393939;
    background: #393939;
    color: #ffffff;
}
</style>
