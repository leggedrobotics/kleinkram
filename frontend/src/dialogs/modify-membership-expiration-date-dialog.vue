<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="running"
        :dirty="isDirty"
        :submit-disabled="!canSave || running"
        @submit="saveExpiration"
    >
        <template #title>Membership Expiration</template>

        <template #content>
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
                            ? 'bg-button-secondary text-white'
                            : 'bg-grey-2 text-grey-8'
                    "
                    :aria-pressed="
                        expirationShortcutState === option.value
                            ? 'true'
                            : 'false'
                    "
                    @click="() => onExpirationSelectionUpdate(option.value)"
                />
            </div>

            <div class="q-mt-md">
                <template v-if="expirationShortcutState === 'custom'">
                    <q-input
                        v-model="datePart"
                        no-error-icon
                        aria-label="Expiration date"
                        outlined
                        dense
                        mask="##.##.####"
                        placeholder="DD.MM.YYYY"
                        hide-bottom-space
                    >
                        <template #append>
                            <q-icon
                                name="sym_o_event"
                                class="cursor-pointer"
                                aria-label="Pick a date"
                                role="img"
                            >
                                <q-popup-proxy
                                    cover
                                    transition-show="scale"
                                    transition-hide="scale"
                                >
                                    <q-date
                                        v-model="datePart"
                                        mask="DD.MM.YYYY"
                                        color="button-primary"
                                    >
                                        <div class="row justify-end">
                                            <q-btn
                                                v-close-popup
                                                flat
                                                no-caps
                                                label="Close"
                                                class="text-button-primary"
                                            />
                                        </div>
                                    </q-date>
                                </q-popup-proxy>
                            </q-icon>
                        </template>
                    </q-input>
                </template>
                <template v-else-if="expirationShortcutState === 'never'">
                    Never expires
                </template>
                <template v-else>
                    Expires <b>{{ datePart }}</b>
                </template>
            </div>
        </template>

        <template #actions>
            <span class="disabled-reason">
                <q-btn
                    flat
                    no-caps
                    label="Save"
                    class="bg-button-primary"
                    :disable="!canSave"
                    :loading="running"
                    @click="saveExpiration"
                />
                <q-tooltip v-if="!canSave">Pick a date</q-tooltip>
            </span>
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { GroupMembershipDto } from '@kleinkram/api-dto/types/access-control/group-membership.dto';
import { useDialogPluginComponent } from 'quasar';
import { useDialogAction } from 'src/composables/use-dialog-action';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { formatDate, parseDate } from 'src/services/date-formating';
import { computed, ref } from 'vue';

const properties = defineProps<{
    agu: GroupMembershipDto;
    /** Saves the date (null: never expires); the dialog closes on success */
    action: (expirationDate: Date | null) => Promise<unknown>;
}>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();

/** 'DD.MM.YYYY HH:mm', the format of formatDate and parseDate */
const expirationDate = ref<string | undefined>(
    properties.agu.expirationDate
        ? formatDate(new Date(properties.agu.expirationDate))
        : undefined,
);

const expirationShortcutState = ref<string>(
    properties.agu.expirationDate ? 'custom' : 'never',
);

const initialState = expirationShortcutState.value;
const initialDate = expirationDate.value;

const isDirty = computed(
    () =>
        expirationShortcutState.value !== initialState ||
        (expirationShortcutState.value !== 'never' &&
            expirationDate.value !== initialDate),
);

/** The day of the expiration, edited in the date field; keeps the time */
const datePart = computed<string>({
    get: () => expirationDate.value?.split(' ')[0] ?? '',
    set: (value: string | null) => {
        const time = expirationDate.value?.split(' ')[1] ?? '00:00';
        expirationDate.value = value ? `${value} ${time}` : undefined;
    },
});

const isValidDate = computed(() => {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(datePart.value);
    if (!match || !expirationDate.value) return false;
    const date = parseDate(expirationDate.value);
    // rejects dates that roll over, e.g. 31.02.
    return (
        !Number.isNaN(date.getTime()) &&
        date.getDate() === Number(match[1]) &&
        date.getMonth() + 1 === Number(match[2])
    );
});

const canSave = computed(
    () => expirationShortcutState.value === 'never' || isValidDate.value,
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

const { running, errorMessage, run } = useDialogAction(() => {
    onDialogOK();
});

/** Saves through the caller's `action`; closes only when that succeeds */
async function saveExpiration(): Promise<void> {
    if (expirationShortcutState.value === 'never') {
        await run(() => properties.action(null));
        return;
    }

    if (!canSave.value || !expirationDate.value) {
        return;
    }
    const expirationDateConverted = parseDate(expirationDate.value);
    await run(() => properties.action(expirationDateConverted));
}
</script>
