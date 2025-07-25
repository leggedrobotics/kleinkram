<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="flex column justify-between"
            style="min-height: 400px; min-width: 600px"
        >
            <div :style="contentStyle">
                <div class="q-pa-lg flex row justify-between">
                    <h3 class="text-h3 q-ma-none" style="max-width: 80%">
                        <slot name="title" />
                    </h3>
                    <q-btn
                        flat
                        dense
                        padding="6px"
                        class="button-border"
                        style="font-size: 14px; line-height: 14px; margin: 0"
                        icon="sym_o_close"
                        @click="onDialogCancel"
                    />
                </div>

                <div v-if="$slots.tabs" class="q-mx-lg justify-start flex">
                    <div class="q-mt-md q-pa-none">
                        <slot name="tabs" />
                    </div>
                </div>

                <q-separator />
                <div
                    style="
                        margin: 40px 24px;
                        max-height: calc(min(650px, 100vh - 350px));
                        overflow-y: auto;
                    "
                >
                    <slot name="content" />
                </div>
            </div>

            <div>
                <q-separator />
                <div class="q-pa-lg flex row justify-end">
                    <slot name="actions" />
                </div>
            </div>
        </q-card>
    </q-dialog>
</template>

<script lang="ts">
import { useDialogPluginComponent } from 'quasar';
import { computed, ComputedRef, CSSProperties, PropType } from 'vue';

export default {
    name: 'BaseDialog',
    props: {
        contentHeight: {
            type: String as PropType<string | undefined>,
            default: undefined,
        },
    },
    emits: [...useDialogPluginComponent.emits],
    setup(properties): ReturnType<useDialogPluginComponent> & {
        contentStyle: ComputedRef<CSSProperties>;
    } {
        const contentStyle = computed<CSSProperties>(() => ({
            height: properties.contentHeight || 'auto',
            overflowY: properties.contentHeight ? 'hidden' : 'visible',
        }));
        const dialogPlugin = useDialogPluginComponent();
        return { ...dialogPlugin, contentStyle };
    },
};
</script>
