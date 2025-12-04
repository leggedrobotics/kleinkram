<template>
    <q-select
        ref="selectReference"
        v-model="selectedSearchItem"
        outlined
        use-input
        hide-selected
        fill-input
        hide-dropdown-icon
        input-debounce="300"
        placeholder="Search users or groups..."
        class="q-pb-md"
        autocomplete="off"
        :options="searchResults"
        @filter="handleSearchFilter"
        @click="enableSearchMode"
    >
        <template #append>
            <q-icon name="sym_o_search" />
        </template>

        <template #no-option>
            <q-item v-if="isSearchActive && searchResults.length > 0">
                <q-item-section class="text-grey">No results</q-item-section>
            </q-item>
        </template>

        <template #option="{ opt }">
            <q-item
                v-ripple
                clickable
                :disable="getExistingRight(opt.uuid) !== undefined"
                @click.stop="() => handleAddAccessGroup(opt)"
            >
                <q-item-section avatar>
                    <AccessGroupAvatar :type="opt.type" />
                </q-item-section>

                <q-item-section>
                    <q-item-label
                        :class="{
                            'text-grey':
                                getExistingRight(opt.uuid) !== undefined,
                        }"
                    >
                        {{ opt.name }}
                    </q-item-label>
                    <q-item-label
                        v-if="opt.type !== AccessGroupType.PRIMARY"
                        caption
                    >
                        {{ opt.memberCount }}
                        {{ opt.memberCount === 1 ? 'member' : 'members' }}
                    </q-item-label>
                </q-item-section>

                <q-item-section
                    v-if="getExistingRight(opt.uuid) !== undefined"
                    side
                >
                    <q-badge
                        color="grey-3"
                        text-color="primary"
                        :label="
                            getAccessRightDescription(
                                getExistingRight(opt.uuid)!,
                            )
                        "
                    />
                </q-item-section>
            </q-item>
        </template>
    </q-select>

    <AccessRightsTable
        :access-rights="accessRights || []"
        :min-access-rights="minAccessRights"
        @update-rights="onUpdateRights"
        @remove="onRemoveGroup"
    />
</template>

<script setup lang="ts">
import { AccessGroupDto } from '@kleinkram/api-dto/types/access-control/access-group.dto';
import { DefaultRightDto } from '@kleinkram/api-dto/types/access-control/default-right.dto';
import { AccessGroupRights, AccessGroupType } from '@kleinkram/shared';
import AccessGroupAvatar from 'components/configure-access-rights/access-group-avatar.vue';
import AccessRightsTable from 'components/configure-access-rights/access-rights-table.vue';
import { QSelect } from 'quasar';
import { useSearchAccessGroup } from 'src/hooks/query-hooks';
import { getAccessRightDescription } from 'src/services/generic';
import { computed, ref } from 'vue';

defineProps<{
    minAccessRights: DefaultRightDto[];
}>();

const accessRights = defineModel<DefaultRightDto[]>({ default: [] });

// State
const selectReference = ref<QSelect>();
const searchQuery = ref('');
const isSearchActive = ref(false);
const selectedSearchItem = ref(undefined);

// Query Hook
const { data: foundAccessGroups } = useSearchAccessGroup(searchQuery);

const searchResults = computed<AccessGroupDto[]>(() => {
    return (
        foundAccessGroups.value?.data.map((r) => ({
            ...r,
            memberCount: r.memberships?.length ?? 0,
        })) ?? []
    );
});

const enableSearchMode = (event?: Event): void => {
    isSearchActive.value = true;
    event?.stopPropagation();
};

const handleSearchFilter = (
    value: string,
    update: (function_: () => void) => void,
): void => {
    searchQuery.value = value;
    enableSearchMode();
    update(() => ({}));
};

const getExistingRight = (uuid: string): AccessGroupRights | undefined => {
    return accessRights.value?.find((g) => g.uuid === uuid)?.rights;
};

const handleAddAccessGroup = (group: AccessGroupDto): void => {
    if (getExistingRight(group.uuid) !== undefined) return;

    // Clear input WITHOUT triggering the filter event (true = noFilter)
    // This prevents the "reopening" loop
    selectReference.value?.updateInputValue('', true);

    // Force close the dropdown
    selectReference.value?.hidePopup();

    // Reset internal state
    isSearchActive.value = false;
    selectedSearchItem.value = undefined;

    // Add the data
    const newEntry: DefaultRightDto = {
        memberCount: group.memberships.length,
        name: group.name,
        uuid: group.uuid,
        type: group.type,
        rights: AccessGroupRights.READ,
    };

    accessRights.value = [...accessRights.value, newEntry];
};

const onUpdateRights = (
    group: DefaultRightDto,
    newRight: AccessGroupRights,
): void => {
    const index = accessRights.value.findIndex((g) => g.uuid === group.uuid);
    if (index === -1) return;

    const updatedList = [...accessRights.value];
    updatedList[index] = { ...group, rights: newRight };

    accessRights.value = updatedList;
};

const onRemoveGroup = (group: DefaultRightDto): void => {
    accessRights.value = accessRights.value.filter(
        (g) => g.uuid !== group.uuid,
    );
};
</script>
