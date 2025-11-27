<template>
    <div class="column q-gutter-y-xs">
        <label v-if="label" class="text-weight-bold">
            {{ label }}
            <span v-if="required" class="text-negative">*</span>
        </label>
        <q-input
            v-model="model"
            outlined
            dense
            :type="type"
            :readonly="readonly"
            :placeholder="placeholder"
            :rules="rules"
            :bg-color="readonly ? 'grey-2' : 'white'"
            :hint="hint"
            lazy-rules
        >
            <template v-for="(_, slot) in $slots" #[slot]="scope">
                <slot :name="slot" v-bind="scope || {}" />
            </template>
        </q-input>
    </div>
</template>

<script setup lang="ts">
import { ValidationRule } from 'quasar';

const model = defineModel<string | number | null>();

withDefaults(
    defineProps<{
        label?: string;
        required?: boolean;
        readonly?: boolean;
        placeholder?: string;
        hint?: string;
        type?: 'text' | 'number' | 'textarea';
        rules?: ValidationRule[];
    }>(),
    {
        type: 'text',
        label: undefined,
        placeholder: undefined,
        hint: undefined,
        rules: () => [],
        required: false,
        readonly: false,
    },
);
</script>
