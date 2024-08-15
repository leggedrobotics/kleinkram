<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 250px; max-width: 1500px"
        >
            <create-file :mission="mission" />
            <div class="q-mt-md row">
                <div class="col-10" />
                <div class="col-2">
                    <q-btn label="OK" color="primary" @click="onDialogCancel" />
                </div>
            </div>
        </q-card>
    </q-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import CreateFile from 'components/CreateFile.vue';
import { Mission } from 'src/types/Mission';

const props = defineProps<{
    mission?: Mission;
}>();
const { dialogRef, onDialogCancel } = useDialogPluginComponent();
</script>
