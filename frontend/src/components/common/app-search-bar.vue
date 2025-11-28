<template>
    <q-input
        ref="inputRef"
        v-model="model"
        :debounce="debounce"
        :placeholder="placeholder"
        dense
        outlined
        hide-bottom-space
        class="app-search-bar"
    >
        <template #append>
            <slot name="append-start" />
            <q-icon
                v-if="model"
                name="sym_o_cancel"
                class="cursor-pointer"
                @click="clear"
            />
            <q-icon v-else name="sym_o_search" />
            <slot name="append-end" />
        </template>
    </q-input>
</template>

<script setup lang="ts">
import { QInput } from 'quasar';
import { ref } from 'vue';

const model = defineModel<string | null | undefined>();

withDefaults(
    defineProps<{
        placeholder?: string;
        debounce?: string | number;
    }>(),
    {
        placeholder: 'Search...',
        debounce: 300,
    },
);

const clear = (): void => {
    model.value = '';
};

const inputRef = ref<QInput | null>(null);

const focus = (): void => {
    inputRef.value?.focus();
};

defineExpose({
    focus,
});
</script>

<style scoped>
.app-search-bar :deep(.q-field__control),
.app-search-bar :deep(.q-field__marginal) {
    height: 36px;
    min-height: 36px;
}
</style>
