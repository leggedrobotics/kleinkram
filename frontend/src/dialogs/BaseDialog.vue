<template>
    <q-dialog ref="dialogRef">
        <q-card class="flex column" style="min-height: 400px; min-width: 600px">
            <div class="q-pa-lg flex row justify-between">
                <h3 class="text-h3 q-ma-none">
                    <slot name="title"></slot>
                </h3>
                <q-btn
                    flat
                    dense
                    padding="6px"
                    class="button-border"
                    icon="sym_o_close"
                    @click="onDialogCancel"
                />
            </div>

            <div class="q-mx-lg justify-start flex">
                <div class="q-mt-sm q-pa-none">
                    <slot name="tabs"></slot>
                </div>
            </div>

            <q-separator />

            <div style="margin: 40px 24px">
                <slot name="content"></slot>
            </div>

            <q-separator />
            <div class="q-pa-lg flex row justify-end">
                <slot name="actions"></slot>
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
