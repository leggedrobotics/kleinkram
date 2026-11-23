<template>
    <div class="row flex items-center justify-between">
        <q-select
            ref="userSelect"
            v-model="selected"
            no-error-icon
            use-input
            multiple
            input-debounce="100"
            color="button-primary"
            options-selected-class="multi-option--selected"
            :options="foundUsers?.users ?? []"
            option-label="name"
            :option-disable="isOptionDisabled"
            :hint="limitHint"
            class="full-width q-mb-md"
            label="Search by name or email"
            @input-value="onInputUpdate"
            @update:model-value="onSelectionChange"
        >
            <template #no-option>
                <q-item>
                    <q-item-section class="text-secondary">
                        No results
                    </q-item-section>
                </q-item>
            </template>
            <template #selected-item="scope">
                <q-chip
                    removable
                    :tabindex="scope.tabindex"
                    :icon="icon(scope.opt.type)"
                    @remove="() => scope.removeAtIndex(scope.index)"
                >
                    {{ scope.opt.name }}
                </q-chip>
            </template>
            <template #option="{ itemProps, opt, selected: isSelected }">
                <q-item v-bind="itemProps">
                    <q-item-section side class="multi-option__check">
                        <q-checkbox
                            :model-value="isSelected"
                            dense
                            size="sm"
                            color="button-primary"
                            tabindex="-1"
                            aria-hidden="true"
                            class="no-pointer-events"
                        />
                    </q-item-section>
                    <q-item-section class="multi-option__label">
                        <q-item-label>{{ opt.name }}</q-item-label>
                        <q-item-label
                            v-if="opt.emailHint"
                            class="user-option__hint"
                        >
                            {{ opt.emailHint }}
                        </q-item-label>
                    </q-item-section>
                </q-item>
            </template>
        </q-select>

        <div v-if="selected.length > 0" class="full-width">
            <label for="addUserRole" class="text-subtitle2 block q-mb-sm">
                Select Role
            </label>
            <q-select
                v-model="selectedRole"
                no-error-icon
                for="addUserRole"
                color="button-primary"
                :options="roleOptions"
                outlined
                dense
                options-dense
                emit-value
                map-options
                class="q-mb-md"
            />

            <div id="addUserExpirationLabel" class="text-subtitle2 q-mb-sm">
                Expiration Date (Optional)
            </div>
            <div
                class="row q-gutter-sm q-mb-md"
                role="group"
                aria-labelledby="addUserExpirationLabel"
            >
                <q-btn
                    v-for="option in expirationOptions"
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

            <div
                v-if="expirationShortcutState === 'custom'"
                class="full-width q-mb-md text-center"
            >
                <q-date
                    v-model="customExpirationDate"
                    mask="DD.MM.YYYY HH:mm"
                    color="button-primary"
                    flat
                    bordered
                    style="display: inline-block"
                />
            </div>
            <div
                v-else-if="expirationShortcutState !== 'never'"
                class="text-caption text-secondary q-mb-md"
            >
                Access will expire on {{ customExpirationDate }}
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import type { UserDto } from '@kleinkram/api-dto/types/user/user.dto';
import { MAX_ACCESS_GROUP_BATCH_SIZE } from '@kleinkram/shared';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { useUserSearch } from 'src/hooks/query-hooks';
import { formatDate, parseDate } from 'src/services/date-formating';
import { icon } from 'src/services/generic';
import { addUsersToAccessGroup } from 'src/services/mutations/access';
import { computed, Ref, ref, watch } from 'vue';

const properties = defineProps<{
    accessGroupUuid: string;
}>();
const queryClient = useQueryClient();

const userSelect = ref();
const search = ref('');
const selected: Ref<UserDto[]> = ref([]);
const { data: foundUsers } = useUserSearch(search);

// One request adds at most this many users: at the limit no further user
// can be picked, and a line under the field says why.
const atLimit = computed(
    () => selected.value.length >= MAX_ACCESS_GROUP_BATCH_SIZE,
);
const isOptionDisabled = (user: UserDto): boolean =>
    atLimit.value &&
    !selected.value.some((picked) => picked.uuid === user.uuid);
const limitHint = computed(() =>
    atLimit.value
        ? `${String(MAX_ACCESS_GROUP_BATCH_SIZE)} selected, the most for one step. Add these, then add more.`
        : undefined,
);

const selectedRole = ref(false);
const roleOptions = [
    { label: 'Member', value: false },
    { label: 'Owner', value: true },
];

const expirationShortcutState = ref<string>('never');
const customExpirationDate = ref<string | undefined>(undefined);

const expirationOptions = [
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

    customExpirationDate.value = formatDate(date);
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

const { mutateAsync } = useMutation({
    mutationFn: async () => {
        let expireDateConverted: Date | 'never' = 'never';
        if (
            expirationShortcutState.value !== 'never' &&
            customExpirationDate.value
        ) {
            expireDateConverted = parseDate(customExpirationDate.value);
        }

        // one request: either all users are added or none, so a failure
        // leaves the selection as it is and can simply be retried
        await addUsersToAccessGroup(
            selected.value.map((user) => user.uuid),
            properties.accessGroupUuid,
            selectedRole.value,
            expireDateConverted,
        );
    },
    onSuccess: async () => {
        Notify.create({
            message: 'Users added to access group',
            color: 'positive',
            position: 'bottom',
        });
        await queryClient.invalidateQueries({
            queryKey: ['AccessGroup', properties.accessGroupUuid],
        });
    },
});

const onInputUpdate = (value: string) => {
    search.value = value;
    if (value.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        userSelect.value?.showPopup(); // Ensure dropdown opens again
    }
};

const onSelectionChange = () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    userSelect.value?.hidePopup();
    if (search.value.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        userSelect.value?.updateInputValue('');
        search.value = '';
    }
};

/** How many are selected, for the dialog's button */
const count = defineModel<number>('count', { default: 0 });
watch(
    () => selected.value.length,
    (length) => {
        count.value = length;
    },
    { immediate: true },
);

defineExpose({ mutateAsync });
</script>

<style scoped>
/* $text-secondary: the email, masked unless the user may see it */
.user-option__hint {
    color: #525252;
    font-size: 12px;
    overflow-wrap: anywhere;
}

.multi-option__check {
    padding-right: 8px;
}

/* the selection shows in the checkbox, the label keeps its colour */
.multi-option__label {
    color: #161616;
}
</style>
