<template>
    <base-dialog ref="dialogRef">
        <template #title>Sign out all other sessions</template>
        <template #content>
            <p class="q-ma-none">
                This ends
                {{
                    count === 1
                        ? '1 other session'
                        : `${String(count)} other sessions`
                }}: other browsers and Kleinkram CLI logins. They need to log in
                again. This browser stays signed in.
            </p>
        </template>
        <template #actions>
            <q-btn
                label="Cancel"
                flat
                class="q-mr-sm button-border"
                @click="onDialogCancel"
            />
            <q-btn
                label="Sign out"
                flat
                class="bg-button-danger"
                @click="onDialogOK"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const { count } = defineProps<{
    count: number;
}>();
</script>
