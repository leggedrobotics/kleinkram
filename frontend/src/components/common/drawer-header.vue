<template>
    <div
        class="q-pa-lg flex row justify-between items-center"
        style="height: 84px"
    >
        <div class="flex column justify-center">
            <h3 class="text-h4 q-ma-none">{{ title }}</h3>
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
