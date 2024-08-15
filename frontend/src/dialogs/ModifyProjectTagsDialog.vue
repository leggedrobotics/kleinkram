<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 250px; max-width: 900px"
        >
            <ConfigureProjectTags :projectUUID="projectUUID" />
        </q-card>
    </q-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';

import ConfigureProjectTags from 'components/ConfigureProjectTags.vue';

const { dialogRef, onDialogCancel } = useDialogPluginComponent();

const props = defineProps<{
    projectUUID: string;
}>();
</script>
<style scoped></style>
