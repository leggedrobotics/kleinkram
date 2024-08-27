<template>
    <div class="bg-white flex column" style="margin: 0 -24px; padding: 0 24px">
        <div style="padding: 24px 0; gap: 24px">
            <div class="flex row justify-between">
                <h1 class="text-h3 q-ma-none">{{ title || '' }}</h1>

                <div>
                    <slot name="buttons"> {{ slots.buttons }}</slot>
                </div>
            </div>

            <div v-if="slots.subtitle">
                <slot name="subtitle"> {{ slots.subtitle }}</slot>
            </div>
        </div>
        <div class="justify-start flex" v-if="$slots.tabs">
            <div class="q-mt-sm q-pa-none">
                <slot name="tabs"></slot>
            </div>
        </div>
    </div>

    <q-separator style="margin: 0 -24px; padding: 0 24px" />
</template>

<script setup lang="ts">
const { title } = defineProps<{
    title: string | undefined;
}>();

const slots = defineSlots<{
    subtitle: string;
    buttons: string;
    tabs: string;
}>();
</script>
