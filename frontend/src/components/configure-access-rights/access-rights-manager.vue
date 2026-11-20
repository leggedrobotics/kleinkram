<template>
    <AccessRightsTable
        :access-rights="groupAccessRights"
        @update-rights="onUpdateRights"
        @remove="onRemoveGroup"
    />

    <q-btn
        flat
        no-caps
        dense
        icon="sym_o_add"
        label="Add user or group"
        class="text-link-primary add-button"
        :class="{ 'add-button--below': groupAccessRights.length > 0 }"
    >
        <q-menu v-model="menuOpen" style="min-width: 320px" @hide="clearSearch">
            <div class="add-menu__search">
                <q-input
                    v-model="searchQuery"
                    no-error-icon
                    dense
                    outlined
                    autofocus
                    debounce="300"
                    color="button-primary"
                    aria-label="Search users or groups"
                    placeholder="Search users or groups"
                    autocomplete="off"
                    @keydown.enter.prevent="addFirstResult"
                >
                    <template #prepend>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>
            </div>
            <q-list class="add-menu__list">
                <q-item v-if="searchResults.length === 0">
                    <q-item-section class="text-secondary">
                        No results
                    </q-item-section>
                </q-item>
                <q-item
                    v-for="opt in searchResults"
                    :key="opt.uuid"
                    clickable
                    :disable="getExistingRight(opt.uuid) !== undefined"
                    @click="() => handleAddAccessGroup(opt)"
                >
                    <q-item-section avatar>
                        <AccessGroupAvatar :type="opt.type" />
                    </q-item-section>

                    <q-item-section>
                        <q-item-label>{{ opt.name }}</q-item-label>
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
                            text-color="grey-9"
                            :label="
                                getAccessRightDescription(
                                    getExistingRight(opt.uuid)!,
                                )
                            "
                        />
                    </q-item-section>
                </q-item>
            </q-list>
        </q-menu>
    </q-btn>

    <GeneralAccessSelector
        v-model="isPublic"
        :disable="generalAccessDisabled"
    />
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
import { useSearchAccessGroup } from 'src/hooks/query-hooks';
import { getAccessRightDescription } from 'src/services/generic';
import { computed, ref } from 'vue';

const accessRights = defineModel<DefaultRightDto[]>({ default: () => [] });

/**
 * Disables making the project public or restricted again, which needs delete
 * rights on the project.
 */
const { generalAccessDisabled } = defineProps<{
    generalAccessDisabled?: boolean;
}>();

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
const menuOpen = ref(false);
const searchQuery = ref('');

// Query Hook (searches on the server)
const { data: foundAccessGroups } = useSearchAccessGroup(searchQuery);

const searchResults = computed<(AccessGroupDto & { memberCount: number })[]>(
    () => {
        return (
            foundAccessGroups.value?.data.map((r) => ({
                // eslint-disable-next-line @typescript-eslint/no-misused-spread
                ...r,

                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                memberCount: r.memberships?.length ?? 0,
            })) ?? []
        );
    },
);

const getExistingRight = (uuid: string): AccessGroupRights | undefined => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return accessRights.value?.find((g) => g.uuid === uuid)?.rights;
};

const handleAddAccessGroup = (group: AccessGroupDto): void => {
    if (getExistingRight(group.uuid) !== undefined) return;
    menuOpen.value = false;

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

const clearSearch = (): void => {
    searchQuery.value = '';
};

/** Enter in the search adds the first result that is not added yet */
const addFirstResult = (): void => {
    const first = searchResults.value.find(
        (group) => getExistingRight(group.uuid) === undefined,
    );
    if (first) handleAddAccessGroup(first);
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

<style scoped>
.add-button--below {
    margin-top: 8px;
}

.add-menu__search {
    padding: 8px;
}

.add-menu__list {
    max-height: 320px;
    overflow-y: auto;
}
</style>
