<template>
    <div style="margin: 10px" class="row flex items-center justify-between">
        <q-select
            ref="userSelect"
            v-model="selected"
            use-input
            multiple
            input-debounce="100"
            color="primary"
            :options="foundUsers?.users ?? []"
            option-label="name"
            class="full-width q-mb-md"
            label="Search by name or email"
            @input-value="onInputUpdate"
            @update:model-value="onSelectionChange"
        >
            <template #no-option>
                <q-item>
                    <q-item-section class="text-grey">
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
            <template #option="{ itemProps, opt }">
                <q-item v-bind="itemProps">
                    <q-item-section>
                        <q-item-label>
                            <div class="row" style="height: 20px">
                                <p
                                    style="
                                        width: 30%;
                                        min-width: 60px;
                                        max-width: 300px;
                                    "
                                >
                                    {{ opt.name }}
                                </p>
                                <p>{{ opt.email }}</p>
                            </div>
                        </q-item-label>
                    </q-item-section>
                </q-item>
            </template>
        </q-select>

        <div v-if="selected.length > 0" class="full-width">
            <div class="text-subtitle2 q-mb-sm">Select Role</div>
            <q-select
                v-model="selectedRole"
                :options="roleOptions"
                outlined
                dense
                options-dense
                emit-value
                map-options
                class="q-mb-md"
            />

            <div class="text-subtitle2 q-mb-sm">Expiration Date (Optional)</div>
            <div class="row q-gutter-sm q-mb-md">
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
                            ? 'bg-white text-grey-10'
                            : 'bg-grey-2 text-grey-8'
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
                class="text-caption text-grey q-mb-md"
            >
                Access will expire on {{ customExpirationDate }}
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import type { UserDto } from '@kleinkram/api-dto/types/user/user.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import { useUserSearch } from 'src/hooks/query-hooks';
import { formatDate, parseDate } from 'src/services/date-formating';
import { icon } from 'src/services/generic';
import { addUserToAccessGroup } from 'src/services/mutations/access';
import { Ref, ref } from 'vue';

const properties = defineProps<{
    accessGroupUuid: string;
}>();
const queryClient = useQueryClient();

const userSelect = ref();
const search = ref('');
const selected: Ref<UserDto[]> = ref([]);
const { data: foundUsers } = useUserSearch(search);

const selectedRole = ref(false);
const roleOptions = [
    { label: 'Viewer', value: false },
    { label: 'Editor', value: true },
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

const { mutate } = useMutation({
    mutationFn: () => {
        let expireDateConverted: Date | 'never' = 'never';
        if (
            expirationShortcutState.value !== 'never' &&
            customExpirationDate.value
        ) {
            expireDateConverted = parseDate(customExpirationDate.value);
        }

        return Promise.all(
            selected.value.map(async (user) => {
                return addUserToAccessGroup(
                    user.uuid,
                    properties.accessGroupUuid,
                    selectedRole.value,
                    expireDateConverted,
                );
            }),
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
    onError: () => {
        Notify.create({
            message: 'Failed to add some users to access group',
            color: 'negative',
            position: 'bottom',
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

defineExpose({ mutate });
</script>

<style scoped></style>
