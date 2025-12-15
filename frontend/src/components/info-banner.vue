<template>
    <div
        class="q-pa-md rounded-borders q-mb-lg flex justify-between items-center relative-position info-banner"
        :class="[`bg-${color}`, `text-${textColor}`]"
    >
        <div class="flex items-center">
            <q-icon name="sym_o_info" class="q-mr-sm" size="sm" />
            <span>{{ text }}</span>
        </div>
        <q-btn
            flat
            dense
            no-caps
            :label="buttonLabel"
            icon-right="sym_o_arrow_forward"
            color="primary"
            @click="emitClick"
        />
    </div>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        text: string;
        buttonLabel: string;
        color?: string;
        textColor?: string;
    }>(),
    {
        color: 'blue-1',
        textColor: 'blue-9',
    },
);

const emit = defineEmits(['click']);

const emitClick = (): void => {
    emit('click');
};
</script>

<style scoped>
.info-banner::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    border-radius: inherit;
    border: 1px solid currentColor;
    opacity: 0.4;
    pointer-events: none;
}
</style>
