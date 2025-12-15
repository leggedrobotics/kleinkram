<template>
    <q-btn
        flat
        style="height: 36px; width: 36px"
        color="icon-secondary"
        class="button-border"
        icon="sym_o_loop"
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
</style>
