<template>
    <div class="bg-white block" style="margin: 0 -24px; padding: 24px">
        <div class="q-py-lg flex row justify-between">
            <h1 class="text-h3 q-ma-none">{{ title }}</h1>

            <div>
                <slot name="buttons"> {{ slots.buttons }}</slot>
            </div>
        </div>

        <div>
            <slot name="subtitle"> {{ slots.subtitle }}</slot>
        </div>
    </div>
</template>

<script setup lang="ts">
const { title } = defineProps<{
    title: string;
}>();

const slots = defineSlots<{
    subtitle: string;
    buttons: string;
}>();
</script>
