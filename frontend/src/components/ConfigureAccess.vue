<template>
    <q-select
        v-model="model"
        outlined
        hide-dropdown-icon
        use-input
        hide-selected
        fill-input
        input-debounce="300"
        placeholder="Seach"
        :options="searchResults"
        class="q-pb-md"
        @click="
            (e) => {
                enableSearch();
                e.stopPropagation();
            }
        "
        @filter="
            (val, update) => {
                groupSearch = val;
                enableSearch();
                // @ts-ignore
                update();
            }
        "
    >
        <template v-if="searchEnabled && searchResults.length" #no-option>
            <q-item>
                <q-item-section class="text-grey"> No results</q-item-section>
            </q-item>
        </template>

        <template #append>
            <q-icon name="sym_o_search" />
        </template>

        <template #option="props">
            <q-item
                v-if="searchEnabled"
                :key="props.opt.uuid"
                v-ripple
                clickable
                @click="
                    () => {
                        if (!searchEnabled) return;
                        searchEnabled = false;
                        model = null;

                        // verify if the group is already in the list
                        if (
                            accessRights?.find((g) => g.uuid === props.opt.uuid)
                        )
                            return;

                        accessRights = accessRights?.concat([
                            {
                                uuid: props.opt.uuid,
                                name: props.opt.name,
                                rights: AccessGroupRights.READ,
                                memberCount: props.opt.memberCount ?? 0,
                            },
                        ]) || [
                            {
                                uuid: props.opt.uuid,
                                name: props.opt.name,
                                rights: AccessGroupRights.READ,
                                memberCount: props.opt.memberCount ?? 0,
                            },
                        ];
                    }
                "
            >
                <q-item-section>
                    <q-item-label
                        :class="{
                            'text-grey': accessRights?.find(
                                (g) => g.uuid === props.opt.uuid,
                            ),
                            'cursor-pointer': !accessRights?.find(
                                (g) => g.uuid === props.opt.uuid,
                            ),
                            'cursor-not-allowed': accessRights?.find(
                                (g) => g.uuid === props.opt.uuid,
                            ),
                        }"
                    >
                        <q-icon
                            v-if="!props.opt.name.startsWith('Personal: ')"
                            name="sym_o_group"
                            class="q-mr-sm"
                            style="
                                background-color: #e8e8e8;
                                padding: 6px;
                                border-radius: 50%;
                            "
                        />
                        <q-icon
                            v-if="props.opt.name.startsWith('Personal: ')"
                            name="sym_o_person"
                            class="q-mr-sm"
                            style="
                                background-color: #e8e8e8;
                                padding: 6px;
                                border-radius: 50%;
                            "
                        />

                        {{ props.opt.name.replace('Personal: ', '') }}
                        <template
                            v-if="!props.opt.name.startsWith('Personal: ')"
                        >
                            <span
                                :class="{
                                    'help-text': !accessRights?.find(
                                        (g) => g.uuid === props.opt.uuid,
                                    ),
                                }"
                            >
                                ({{ props.opt.memberCount }} members)
                            </span>
                        </template>

                        <template
                            v-if="
                                accessRights?.find(
                                    (g) => g.uuid === props.opt.uuid,
                                )
                            "
                        >
                            {{
                                accessRights?.find(
                                    (g) => g.uuid === props.opt.uuid,
                                )?.rights
                                    ? ` - ${getAccessRightDescription(
                                          accessRights?.find(
                                              (g) => g.uuid === props.opt.uuid,
                                          )?.rights,
                                      )}`
                                    : ''
                            }}
                        </template>
                    </q-item-label>
                </q-item-section>
            </q-item>
        </template>
    </q-select>

    <q-table
        class="table-white"
        :columns="accessRightsColumns as any"
        :rows="sortedAccessRights"
        hide-pagination
        flat
        separator="horizontal"
        bordered
        style="margin-top: 6px"
        binary-state-sort
    >
        <template #body-cell-name="props">
            <q-td :props="props">
                <q-icon
                    v-if="!props.row.name.startsWith('Personal: ')"
                    name="sym_o_group"
                    class="q-mr-sm"
                    style="
                        background-color: #e8e8e8;
                        padding: 6px;
                        border-radius: 50%;
                    "
                />
                <q-icon
                    v-if="props.row.name.startsWith('Personal: ')"
                    name="sym_o_person"
                    class="q-mr-sm"
                    style="
                        background-color: #e8e8e8;
                        padding: 6px;
                        border-radius: 50%;
                    "
                />
                {{ props.row.name.replace('Personal: ', '') }}
                <span
                    v-if="!props.row.name.startsWith('Personal: ')"
                    class="help-text"
                >
                    ({{ props.row.memberCount }} members)
                </span>
            </q-td>
        </template>

        <template #body-cell-rights="props">
            <q-td :props="props">
                <q-btn-dropdown
                    flat
                    outlined
                    style="background-color: #e8e8e8"
                    :label="getAccessRightDescription(props.row.rights)"
                    auto-close
                >
                    <q-list>
                        <q-item
                            v-for="option in accessGroupRightsList"
                            :key="option"
                            clickable
                            :disable="isBelowMinRights(props.row, option)"
                            @click="() => updateRights(props.row, option)"
                        >
                            <q-tooltip
                                v-if="isBelowMinRights(props.row, option)"
                            >
                                This option cannot be set.
                            </q-tooltip>
                            <q-item-section>
                                <q-item-label>
                                    {{ getAccessRightDescription(option) }}
                                </q-item-label>
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
            </q-td>
        </template>

        <template #body-cell-actions="props">
            <q-td :props="props">
                <q-btn
                    flat
                    round
                    dense
                    icon="sym_o_delete"
                    unelevated
                    color="primary"
                    class="cursor-pointer"
                    :disable="
                        !!minAccessRights.filter(
                            (r) => r.uuid === props.row.uuid,
                        ).length
                    "
                    :text-color="
                        !!minAccessRights.filter(
                            (r) => r.uuid === props.row.uuid,
                        ).length
                            ? 'grey'
                            : 'red'
                    "
                    @click="() => removeGroup(props.row)"
                />
            </q-td>
        </template>
    </q-table>
</template>
<script setup lang="ts">
import { getAccessRightDescription } from 'src/services/generic';
import { QSelect, QTable } from 'quasar';
import { computed, ref } from 'vue';

import { useQuery } from '@tanstack/vue-query';
import { searchAccessGroups } from 'src/services/queries/access';
import { DefaultRightDto } from '@api/types/DefaultRights.dto';
import { AccessGroupRights } from '@common/enum';
import { accessGroupRightsList } from '../enums/accessGroupRightsList';

const { minAccessRights } = defineProps<{
    minAccessRights: DefaultRightDto[];
}>();
const accessRights = defineModel<DefaultRightDto[]>();

const sortedAccessRights = computed(() =>
    [...(accessRights.value || [])].sort((a, b) =>
        b.name.localeCompare(a.name),
    ),
);

const groupSearch = ref('');
const searchEnabled = ref(false);
const model = ref(null);

const accessRightsColumns = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        sortable: true,
    },
    {
        name: 'rights',
        required: true,
        label: 'Rights',
        align: 'left',
        sortable: false,
    },
    {
        name: 'actions',
        required: true,
        label: '',
        align: 'center',
    },
];

const updateRights = (group: AccessRight, right: AccessGroupRights) => {
    if (isBelowMinRights(group, right)) {
        console.log('Cannot set rights below minimum');
        return;
    }

    accessRights.value =
        accessRights.value?.map((g) => {
            if (g.name === group.name) {
                return { ...g, rights: right };
            }
            return g;
        }) || [];
};

const removeGroup = (group: AccessGroupRights) => {
    if (minAccessRights.filter((r) => r.uuid === group.uuid).length > 0) {
        console.log('Cannot remove minimum access group');
        return;
    }

    accessRights.value = accessRights.value?.filter(
        (g) => g.name !== group.name,
    );
};

const enabled = computed(() => groupSearch.value.length >= 2);
const searchAccessGroupsKey = computed(() => [
    'accessGroups',
    groupSearch.value,
]);
const { data: foundAccessGroups } = useQuery({
    queryKey: searchAccessGroupsKey,
    queryFn: () =>
        searchAccessGroups(groupSearch.value, false, false, false, 0, 10),
    enabled,
});

const searchAccessGroupsUserKey = computed(() => [
    'accessGroupsUser',
    groupSearch.value,
]);
const { data: foundUsers } = useQuery({
    queryKey: searchAccessGroupsUserKey,
    queryFn: () =>
        searchAccessGroups(groupSearch.value, true, false, false, 0, 10),
    enabled,
});

const isBelowMinRights = (group: AccessRight, right: AccessGroupRights) => {
    const minAccess = minAccessRights.find((r) => r.uuid === group.uuid);
    return minAccess && minAccess.rights > right;
};

const searchResults = computed(() => {
    const results: AccessRight[] = [];

    foundAccessGroups.value?.[0].forEach((group) => {
        results.push({
            uuid: group.uuid,
            name: group.name,
            rights: null,
            memberCount: group.memberships.length > 0 || 0,
        });
    });

    foundUsers.value?.[0].forEach((group) => {
        results.push({
            uuid: group.uuid,
            name: group.name,
            rights: null,
            memberCount: 1,
        });
    });

    return results;
});

const enableSearch = () => {
    searchEnabled.value = true;
};
</script>

<style scoped></style>
