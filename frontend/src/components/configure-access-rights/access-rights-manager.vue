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
        :access-rights="groupAccessRights"
        @update-rights="onUpdateRights"
        @remove="onRemoveGroup"
    />

    <GeneralAccessSelector v-model="isPublic" />
</template>

<script setup lang="ts">
import type { AccessGroupDto } from '@kleinkram/api-dto/types/access-control/access-group.dto';
import type { DefaultRightDto } from '@kleinkram/api-dto/types/access-control/default-right.dto';
import {
    AccessGroupRights,
    AccessGroupType,
    PUBLIC_ACCESS_GROUP,
    PUBLIC_ACCESS_RIGHTS,
} from '@kleinkram/shared';
import AccessGroupAvatar from 'components/configure-access-rights/access-group-avatar.vue';
import AccessRightsTable from 'components/configure-access-rights/access-rights-table.vue';
import GeneralAccessSelector from 'components/configure-access-rights/general-access-selector.vue';
import { QSelect } from 'quasar';
import { useSearchAccessGroup } from 'src/hooks/query-hooks';
import { getAccessRightDescription } from 'src/services/generic';
import { computed, ref } from 'vue';

const accessRights = defineModel<DefaultRightDto[]>({ default: () => [] });

/**
 * The public access group is part of the same list of access rights, but it
 * is shown as the "General access" setting instead of as a row of the table.
 */
const isPublicAccess = (access: DefaultRightDto): boolean =>
    access.type === AccessGroupType.PUBLIC ||
    access.uuid === PUBLIC_ACCESS_GROUP.uuid;

const groupAccessRights = computed(() =>
    accessRights.value.filter((access) => !isPublicAccess(access)),
);

const isPublic = computed({
    get: () => accessRights.value.some((access) => isPublicAccess(access)),
    set: (value: boolean) => {
        accessRights.value = value
            ? [
                  ...groupAccessRights.value,
                  {
                      uuid: PUBLIC_ACCESS_GROUP.uuid,
                      name: PUBLIC_ACCESS_GROUP.name,
                      type: AccessGroupType.PUBLIC,
                      rights: PUBLIC_ACCESS_RIGHTS,
                      memberCount: 0,
                  },
              ]
            : groupAccessRights.value;
    },
});

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
            // eslint-disable-next-line @typescript-eslint/no-misused-spread
            ...r,

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
    updatedList[index] = { ...group, rights: newRight };

    accessRights.value = updatedList;
};

const onRemoveGroup = (group: DefaultRightDto): void => {
    accessRights.value = accessRights.value.filter(
        (g) => g.uuid !== group.uuid,
    );
};
</script>
