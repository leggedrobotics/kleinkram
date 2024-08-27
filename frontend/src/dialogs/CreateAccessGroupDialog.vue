<template>
    <base-dialog ref="dialogRef">
        <template #title> New Access Rights</template>

        <template #content>
            <label for="name">Group Name</label>
            <q-input v-model="name" placeholder="Name" name="name" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Create Access Group"
                class="bg-button-primary"
                @click="() => onDialogOK(name)"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/BaseDialog.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const name = ref('');
</script>

<style scoped></style>
