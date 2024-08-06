<template>
    <q-dialog ref="dialogRef" persistent style="max-width: 1500px">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 250px; max-width: 1500px"
        >
            <create-file :mission="props.mission" />
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
import { useDialogPluginComponent } from 'quasar';
import CreateFile from 'components/CreateFile.vue';
import { Mission } from 'src/types/Mission';
const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    mission?: Mission;
}>();
</script>

<style scoped></style>
