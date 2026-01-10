<template>
    <div :class="classes">
        <div class="row q-gutter-x-sm">
            <q-btn
                v-for="option in normalizedOptions"
                :key="String(option.value)"
                :label="option.label"
                :class="getButtonClass(option)"
                :icon="option.icon"
                unelevated
                dense
                size="sm"
                no-caps
                class="q-px-sm"
                @click="() => onToggle(option)"
            >
                <q-tooltip v-if="option.tooltip">{{
                    option.tooltip
                }}</q-tooltip>
            </q-btn>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Option {
    label: string;
    value: string;
    icon?: string;
    tooltip?: string;
    special?: boolean; // For 'All' button behavior
}

const props = withDefaults(
    defineProps<{
        options: Option[];
        modelValue: string | string[]; // Single value or Array of values
        type?: 'single' | 'multi';
        classes?: string;
    }>(),
    {
        type: 'single',
        classes: '',
    },
);

const emit =
    defineEmits<
        (event: 'update:modelValue', value: string | string[]) => void
    >();

const normalizedOptions = computed(() => props.options);

function isSelected(option: Option): boolean {
    if (props.type === 'single') {
        return props.modelValue === option.value;
    } else {
        if (Array.isArray(props.modelValue)) {
            // For multi-select, assuming values are strings
            return props.modelValue.includes(option.value);
        }
        return false;
    }
}

function getButtonClass(option: Option): string {
    const selected = isSelected(option);
    if (selected) {
        return 'bg-white text-grey-10 border-solid-grey';
    }
    return 'bg-grey-2 text-grey-8';
}

function onToggle(option: Option) {
    if (props.type === 'single') {
        if (props.modelValue !== option.value) {
            emit('update:modelValue', option.value);
        }
    } else {
        // Multi-select logic
        const current = Array.isArray(props.modelValue)
            ? [...props.modelValue]
            : [];
        const value = option.value;

        // Handle "All" logic
        if (option.special && option.label === 'All') {
            emit('update:modelValue', [value]);
        } else {
            const index = current.indexOf(value);
            if (index === -1) {
                current.push(value);
            } else {
                current.splice(index, 1);
            }
            emit('update:modelValue', current);
        }
    }
}
</script>

<style scoped>
.border-solid-grey {
    border: 1px solid #424242; /* grey-9 */
}
</style>
