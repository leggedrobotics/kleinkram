<template>
    <div
        class="q-pa-lg flex row no-wrap justify-between items-center drawer-header"
    >
        <div class="flex column justify-center drawer-header__text">
            <h3 class="q-ma-none drawer-header__title">{{ title }}</h3>
            <span v-if="subtitle" class="text-caption text-grey-7">
                {{ subtitle }}
            </span>
        </div>
        <q-btn
            flat
            dense
            padding="6px"
            class="button-border"
            icon="sym_o_close"
            @click="emitClose"
        >
            <q-tooltip>Close</q-tooltip>
        </q-btn>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    title: string;
    subtitle?: string;
}>();

const emit = defineEmits(['close']);

const emitClose = (): void => {
    emit('close');
};
</script>

<style scoped>
.drawer-header {
    min-height: 84px;
    gap: 12px;
}

.drawer-header__text {
    min-width: 0;
    overflow-wrap: anywhere;
}

.drawer-header__title {
    /* text-h4 */
    font-size: 2.125rem;
    font-weight: 400;
    line-height: 2.5rem;
    letter-spacing: 0.00735em;
}

@media (max-width: 599px) {
    .drawer-header {
        padding: 16px;
    }

    .drawer-header__title {
        /* text-h5 */
        font-size: 1.5rem;
        line-height: 2rem;
        letter-spacing: normal;
    }
}
</style>
