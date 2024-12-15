<template>
    <base-dialog ref="dialogRef">
        <template #title> Membership Expiration</template>

        <template #content>
            <q-date
                v-model="expirationDate"
                label="Expiration Date"
                mask="DD.MM.YYYY HH:mm"
                color="light-green"
                flat
                bordered
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Never"
                class="bg-button-primary"
                style="margin-right: 8px"
                @click="neverExpire"
            />
            <q-btn
                flat
                label="Save"
                class="bg-button-primary"
                @click="saveExpiration"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from './base-dialog.vue';
import { ref } from 'vue';
import { formatDate, parseDate } from '../services/date-formating';
import { GroupMembershipDto } from '@api/types/user.dto';

const properties = defineProps<{
    agu: GroupMembershipDto;
}>();

const expirationDate = ref<string | undefined>(
    properties.agu.expirationDate
        ? formatDate(properties.agu.expirationDate)
        : undefined,
);

const { dialogRef, onDialogOK } = useDialogPluginComponent();

function saveExpiration() {
    if (!expirationDate.value) {
        return;
    }
    const expirationDateConverted = parseDate(expirationDate.value);
    onDialogOK(expirationDateConverted);
}

function neverExpire() {
    onDialogOK();
}
</script>
