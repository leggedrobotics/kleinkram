<template>
    <q-btn
        flat
        color="icon-secondary"
        class="button-border app-refresh-button"
        icon="sym_o_loop"
        aria-label="Refetch the data"
        @click="handleClick"
    >
        <q-tooltip>Refetch the Data</q-tooltip>
    </q-btn>
</template>

<script setup lang="ts">
const emits = defineEmits(['click']);

const handleClick = (): void => {
    emits('click');
};
</script>

<style scoped>
.button-border {
    border: 1px solid #e0e0e0;
    border-radius: 4px;
}

.app-refresh-button {
    height: 36px;
    width: 36px;
}

/* Touch target on small screens */
@media (max-width: 1023px) {
    .app-refresh-button {
        height: 40px;
        width: 40px;
    }
}
</style>
