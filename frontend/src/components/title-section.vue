<template>
    <div class="bg-white flex column" style="margin: 0 -24px; padding: 0 24px">
        <div style="padding: 24px 0; gap: 24px; padding-bottom: 10px">
            <div class="flex row justify-between">
                <div class="col">
                    <h1 class="text-h3 q-ma-none">
                        {{ title ?? '' }}
                    </h1>
                    <div v-if="slots.subtitle" class="q-pt-md">
                        <slot name="subtitle">
                            {{ slots.subtitle }}
                        </slot>
                    </div>
                </div>

                <div>
                    <slot name="buttons">
                        {{ slots.buttons }}
                    </slot>
                </div>
            </div>
        </div>
        <div v-if="$slots.tabs" class="justify-start flex">
            <div class="q-mt-sm q-pa-none">
                <slot name="tabs" />
            </div>
        </div>
        <div v-else style="height: 14px" />
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
