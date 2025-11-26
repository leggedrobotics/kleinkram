<template>
    <div class="column q-gutter-y-xs">
        <label v-if="label" class="text-weight-bold">
            {{ label }}
            <span v-if="required" class="text-negative">*</span>
        </label>

        <q-select
            v-bind="$attrs"
            v-model="model"
            outlined
            dense
            map-options
            emit-value
            :options="options"
            :option-label="optionLabel"
            :option-value="optionValue"
            :bg-color="$attrs.readonly || $attrs.disable ? 'grey-2' : 'white'"
        >
            <template v-for="(_, slot) in $slots" #[slot]="scope">
                <slot :name="slot" v-bind="scope || {}" />
            </template>
        </q-select>
    </div>
</template>

<script
    setup
    lang="ts"
    generic="T, V extends string | number | object | boolean | null = string"
>
const model = defineModel<V | null | undefined>();

defineOptions({ inheritAttrs: false });

withDefaults(
    defineProps<{
        label?: string | undefined;
        required?: boolean | undefined;
        options?: readonly T[] | undefined;
        optionLabel?: string | ((opt: T) => string) | undefined;
        optionValue?: string | ((opt: T) => V) | undefined;
    }>(),
    {
        options: () => [],
        label: undefined,
        optionLabel: undefined,
        optionValue: undefined,
        required: false,
    },
);
</script>
