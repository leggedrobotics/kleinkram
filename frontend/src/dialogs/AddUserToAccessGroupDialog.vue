<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 150px; max-width: 800px"
        >
            <AddUserToAccessGroup :access_group="props.access_group" />
        </q-card>
    </q-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import AddUserToAccessGroup from 'components/AddUserToAccessGroup.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    access_group: string;
}>();
</script>

<style scoped></style>
