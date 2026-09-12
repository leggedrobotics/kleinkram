<template>
    <div class="bg-white flex column title-section">
        <div class="title-section__inner">
            <div class="row justify-between items-start q-gutter-y-md">
                <div class="col-12 col-md column" style="min-width: 0">
                    <slot name="title">
                        <div class="row no-wrap items-center" style="gap: 16px">
                            <h1 class="text-h5 text-md-h3 q-ma-none ellipsis">
                                {{ title ?? '' }}
                                <q-tooltip v-if="title">
                                    {{ title }}
                                </q-tooltip>
                            </h1>
                            <slot name="titleAppend" />
                        </div>
                    </slot>
                    <div v-if="slots.subtitle" class="q-pt-md">
                        <slot name="subtitle" />
                    </div>
                </div>

                <div
                    class="col-12 col-md-auto flex title-section__buttons"
                    :class="$q.screen.gt.sm ? 'justify-end' : 'justify-start'"
                >
                    <slot name="buttons" />
                </div>
            </div>
        </div>
        <div v-if="slots.tabs" class="justify-start flex scroll-x-nowrap">
            <div class="q-mt-sm q-pa-none">
                <slot name="tabs" />
            </div>
        </div>
        <div v-else style="height: 14px" />
    </div>

    <q-separator class="title-section__separator" />
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { useSlots } from 'vue';

const $q = useQuasar();

const { title } = defineProps<{
    title: string | undefined;
}>();

const slots = useSlots();

defineSlots<{
    title: string;
    titleAppend: string;
    subtitle: string;
    buttons: string;
    tabs: string;
}>();
</script>

<style scoped>
.title-section,
.title-section__separator {
    margin: 0 calc(-1 * var(--page-gutter));
    padding: 0 var(--page-gutter);
}

.title-section__inner {
    padding: 24px 0 10px;
    gap: 24px;
}

@media (max-width: 1023px) {
    .title-section__inner {
        padding: 16px 0 8px;
    }

    /* Wrapped action buttons need room between rows on small screens */
    .title-section__buttons {
        gap: 8px;
        max-width: 100%;
    }
}
</style>
