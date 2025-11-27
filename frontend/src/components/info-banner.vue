<template>
    <div
        class="bg-blue-1 q-pa-md rounded-borders q-mb-lg flex justify-between items-center text-blue-9"
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
defineProps<{
    text: string;
    buttonLabel: string;
}>();

const emit = defineEmits(['click']);

const emitClick = (): void => {
    emit('click');
};
</script>
