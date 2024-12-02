<template>
    <base-dialog ref="dialogRef">
        <template #title> Membership Expiration </template>

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
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { ref } from 'vue';
import { formatDate, parseDate } from 'src/services/dateFormating';
import { GroupMembershipDto } from '@api/types/User.dto';

const props = defineProps<{
    agu: GroupMembershipDto;
}>();

const expirationDate = ref<string | null>(
    props.agu.expirationDate ? formatDate(props.agu.expirationDate) : null,
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
    onDialogOK(null);
}
</script>
