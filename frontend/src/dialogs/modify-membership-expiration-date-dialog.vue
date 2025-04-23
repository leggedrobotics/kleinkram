<template>
    <base-dialog ref="dialogRef">
        <template #title> Membership Expiration</template>

        <template #content>
            <div class="flex justify-center">
                <q-date
                    v-model="expirationDate"
                    label="Expiration Date"
                    mask="DD.MM.YYYY HH:mm"
                    color="light-green"
                    flat
                    bordered
                />
            </div>
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
import { GroupMembershipDto } from '@api/types/user.dto';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { formatDate, parseDate } from 'src/services/date-formating';
import { ref } from 'vue';

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
