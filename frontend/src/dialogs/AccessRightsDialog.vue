<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 250px; max-width: 1500px"
        >
            <AccessRights :project_uuid="props.project_uuid" />
            <div class="q-mt-md row">
                <div class="col-10" />
                <div class="col-2">
                    <q-btn label="Close" color="orange" @click="onDialogOK" />
                </div>
            </div>
        </q-card>
    </q-dialog>
</template>
<script setup lang="ts">
import AccessRights from 'components/AccessRights.vue';
import { useDialogPluginComponent } from 'quasar';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    project_uuid: string;
}>();
</script>

<style scoped></style>
