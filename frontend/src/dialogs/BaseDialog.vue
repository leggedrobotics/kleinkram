<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="flex column justify-between"
            style="min-height: 400px; min-width: 600px"
        >
            <div>
                <div class="q-pa-lg flex row justify-between">
                    <h3 class="text-h3 q-ma-none" style="max-width: 80%">
                        <slot name="title"></slot>
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

                <div class="q-mx-lg justify-start flex" v-if="$slots.tabs">
                    <div class="q-mt-md q-pa-none">
                        <slot name="tabs"></slot>
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
                    <slot name="content"></slot>
                </div>
            </div>

            <div>
                <q-separator />
                <div class="q-pa-lg flex row justify-end">
                    <slot name="actions"></slot>
                </div>
            </div>
        </q-card>
    </q-dialog>
</template>

<script lang="ts">
import { useDialogPluginComponent } from 'quasar';

export default {
    emits: [...useDialogPluginComponent.emits],

    setup() {
        const { dialogRef, onDialogCancel } = useDialogPluginComponent();
        return {
            dialogRef,
            onDialogCancel,
        };
    },
};
</script>
