<template>
    <div class="row">
        <div style="width: 300px">
            <q-btn
                label="Reset Minio Tagging"
                class="button-border bg-button-primary full-width"
                @click="resetMinioTagging"
                icon="sym_o_sell"
                flat
            />
            <div class="help-text q-pt-sm">
                This will delete the Minio tags for all files in the system and
                then regenerate them based on the current DB state. This action
                cannot be undone. There is no confirmation!
            </div>
        </div>
        <div style="width: 300px; margin-left: 20px">
            <q-btn
                label="Recompute File Sizes"
                class="button-border bg-button-primary full-width"
                @click="resetFileSizes"
                icon="sym_o_expand"
                flat
            />
            <div class="help-text q-pt-sm">
                This will recompute the file sizes in the database by asking
                Minio for the size of each file. This action cannot be undone.
                There is no confirmation!
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import axios from 'src/api/axios';
import { useQuasar } from 'quasar';

const $q = useQuasar();

async function resetMinioTagging() {
    await axios.post('file/resetMinioTags');

    $q.notify({
        message: 'Resetting Minio tagging started',
        color: 'positive',
        position: 'bottom',
        timeout: 2000,
    });
}

async function resetFileSizes() {
    await axios.post('file/recomputeFileSizes');

    $q.notify({
        message: 'Recomputing file sizes started',
        color: 'positive',
        position: 'bottom',
        timeout: 2000,
    });
}
</script>
