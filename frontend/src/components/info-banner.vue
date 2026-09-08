<template>
    <div
        class="q-pa-md rounded-borders q-mb-lg flex justify-between items-center relative-position info-banner"
        :class="[`bg-${color}`, `text-${textColor}`]"
    >
        <div class="flex items-center info-banner__text">
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
/*
 * On phones the text and the button do not fit next to each other, so the
 * banner turns into a stack with the action below the message.
 */
@media (max-width: 599px) {
    .info-banner {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
    }

    .info-banner__text {
        align-items: flex-start;
        flex-wrap: nowrap;
    }

    .info-banner__text .q-icon {
        margin-top: 2px;
    }
}

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
