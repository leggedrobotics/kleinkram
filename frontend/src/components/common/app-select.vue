<template>
    <div class="column q-gutter-y-xs">
        <label v-if="label" class="text-weight-bold">
            {{ label }}
            <span v-if="required" class="text-negative">*</span>
        </label>

        <q-select
            v-bind="$attrs"
            v-model="model"
            :label="inputLabel"
            outlined
            dense
            map-options
            emit-value
            :options="filteredOptions"
            :option-label="optionLabel"
            :option-value="optionValue"
            :use-input="searchable && !model"
            :bg-color="
                bgColor ??
                ($attrs.readonly || $attrs.disable ? 'grey-2' : 'white')
            "
            @filter="filterFunction"
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
import { ref, watch } from 'vue';

const model = defineModel<V | null | undefined>();

defineOptions({ inheritAttrs: false });

const props = withDefaults(
    defineProps<{
        label?: string | undefined;
        inputLabel?: string | undefined;
        required?: boolean | undefined;
        options?: readonly T[] | undefined;
        optionLabel?: string | ((opt: T) => string) | undefined;
        optionValue?: string | ((opt: T) => V) | undefined;
        bgColor?: string | undefined;
        searchable?: boolean;
    }>(),
    {
        options: () => [],
        label: undefined,
        inputLabel: undefined,
        optionLabel: undefined,
        optionValue: undefined,
        required: false,
        bgColor: undefined,
        searchable: false,
    },
);

const filteredOptions = ref<readonly T[]>([]);

watch(
    () => props.options,
    (newOptions) => {
        filteredOptions.value = newOptions;
    },
    { immediate: true },
);

function filterFunction(
    value: string,
    update: (function_: () => void) => void,
) {
    if (value === '') {
        update(() => {
            filteredOptions.value = props.options;
        });
        return;
    }

    update(() => {
        const needle = value.toLowerCase();
        filteredOptions.value = props.options.filter((v) => {
            let label: unknown = v;
            if (typeof props.optionLabel === 'function') {
                label = props.optionLabel(v);
            } else if (
                props.optionLabel &&
                typeof v === 'object' &&
                v !== null
            ) {
                label = (v as Record<string, unknown>)[props.optionLabel];
            }

            return String(label).toLowerCase().includes(needle);
        });
    });
}
</script>
