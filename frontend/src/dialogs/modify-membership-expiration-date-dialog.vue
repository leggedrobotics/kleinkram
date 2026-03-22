<template>
    <base-dialog ref="dialogRef">
        <template #title> Membership Expiration</template>

        <template #content>
            <div class="column q-gutter-y-md">
                <div class="row q-gutter-sm">
                    <q-btn
                        v-for="option in options"
                        :key="String(option.value)"
                        :label="option.label"
                        :icon="option.icon"
                        flat
                        dense
                        no-caps
                        class="button-border q-px-sm"
                        :class="
                            expirationShortcutState === option.value
                                ? 'bg-white text-grey-10'
                                : 'bg-grey-2 text-grey-8'
                        "
                        @click="() => onExpirationSelectionUpdate(option.value)"
                    />
                </div>

                <div style="min-height: 380px">
                    <div
                        v-if="expirationShortcutState === 'custom'"
                        class="flex justify-center"
                    >
                        <q-date
                            v-model="expirationDate"
                            mask="DD.MM.YYYY HH:mm"
                            color="button-primary"
                            flat
                            bordered
                        />
                    </div>
                    <div
                        v-else
                        class="flex column items-center justify-center text-grey-6"
                        style="height: 100%; min-height: 380px"
                    >
                        <q-icon
                            :name="
                                expirationShortcutState === 'never'
                                    ? 'sym_o_all_inclusive'
                                    : 'sym_o_event_available'
                            "
                            size="64px"
                            class="q-mb-md"
                        />
                        <div class="text-h6 text-weight-regular">
                            {{
                                expirationShortcutState === 'never'
                                    ? 'No Expiration'
                                    : 'Expiration Updated'
                            }}
                        </div>
                        <div class="text-caption">
                            {{
                                expirationShortcutState === 'never'
                                    ? 'This user will have access indefinitely.'
                                    : `Access will expire on ${expirationDate}`
                            }}
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <template #actions>
            <q-btn
                v-close-popup
                flat
                label="Cancel"
                class="text-button-primary"
                style="margin-right: 8px"
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
import type { GroupMembershipDto } from '@kleinkram/api-dto/types/access-control/group-membership.dto';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { formatDate, parseDate } from 'src/services/date-formating';
import { ref } from 'vue';

const properties = defineProps<{
    agu: GroupMembershipDto;
}>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const expirationDate = ref<string | undefined>(
    properties.agu.expirationDate
        ? formatDate(properties.agu.expirationDate)
        : undefined,
);

const expirationShortcutState = ref<string>(
    properties.agu.expirationDate ? 'custom' : 'never',
);

const options = [
    { label: 'Never', value: 'never' },
    { label: '1 Week', value: '1week' },
    { label: '1 Month', value: '1month' },
    { label: '6 Months', value: '6months' },
    { label: '1 Year', value: '1year' },
    { label: 'Custom', value: 'custom', icon: 'sym_o_date_range' },
];

function applyShortcut(type: '1week' | '1month' | '6months' | '1year') {
    const date = new Date();
    if (type === '1week') date.setDate(date.getDate() + 7);
    if (type === '1month') date.setMonth(date.getMonth() + 1);
    if (type === '6months') date.setMonth(date.getMonth() + 6);
    if (type === '1year') date.setFullYear(date.getFullYear() + 1);

    expirationDate.value = formatDate(date);
}

function onExpirationSelectionUpdate(
    value: string | string[] | number | number[] | null,
) {
    if (typeof value !== 'string') return;

    expirationShortcutState.value = value;
    if (value !== 'custom' && value !== 'never') {
        applyShortcut(value as '1week' | '1month' | '6months' | '1year');
    }
}

function saveExpiration() {
    if (expirationShortcutState.value === 'never') {
        onDialogOK();
        return;
    }

    if (!expirationDate.value) {
        return;
    }
    const expirationDateConverted = parseDate(expirationDate.value);
    onDialogOK(expirationDateConverted);
}
</script>

<style scoped></style>
