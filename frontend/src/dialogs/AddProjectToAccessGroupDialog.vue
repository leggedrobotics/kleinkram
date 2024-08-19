<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 150px; max-width: 1200px"
        >
            <AddProjectToAccessGroupDialog :access_group="props.access_group" />
        </q-card>
    </q-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import AddProjectToAccessGroupDialog from 'src/components/AddProjectToAccessGroup.vue';
const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    access_group: string;
}>();
</script>

<style scoped></style>
