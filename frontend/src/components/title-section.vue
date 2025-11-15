<template>
    <div class="bg-white flex column" style="margin: 0 -24px; padding: 0 24px">
        <div style="padding: 24px 0; gap: 24px; padding-bottom: 10px">
            <div class="row justify-between items-center q-gutter-y-md">
                <div class="col-12 col-md">
                    <h1 class="text-h5 text-md-h3 q-ma-none ellipsis">
                        {{ title ?? '' }}
                        <q-tooltip v-if="title">
                            {{ title }}
                        </q-tooltip>
                    </h1>
                    <div v-if="slots.subtitle" class="q-pt-md">
                        <slot name="subtitle" />
                    </div>
                </div>

                <div class="col-12 col-md-auto flex justify-end">
                    <slot name="buttons" />
                </div>
            </div>
        </div>
        <div v-if="slots.tabs" class="justify-start flex">
            <div class="q-mt-sm q-pa-none">
                <slot name="tabs" />
            </div>
        </div>
        <div v-else style="height: 14px" />
    </div>

    <q-separator style="margin: 0 -24px; padding: 0 24px" />
</template>

<script setup lang="ts">
import { useSlots } from 'vue';

const { title } = defineProps<{
    title: string | undefined;
}>();

const slots = useSlots();

defineSlots<{
    subtitle: string;
    buttons: string;
    tabs: string;
}>();
</script>
