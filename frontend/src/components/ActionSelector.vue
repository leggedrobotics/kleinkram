<template>
    <q-select
        outlined
        hide-dropdown-icon
        v-model="model"
        use-input
        hide-selected
        fill-input
        input-debounce="300"
        placeholder="Seach"
        :options="searchResults"
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
                update();
            }
        "
        class="q-pb-md"
    >
        <template v-slot:no-option v-if="searchEnabled && searchResults.length">
            <q-item>
                <q-item-section class="text-grey"> No results</q-item-section>
            </q-item>
        </template>

        <template v-slot:append>
            <q-icon name="sym_o_search" />
        </template>

        <template v-slot:option="props">
            <q-item
                v-if="searchEnabled"
                :key="props.opt.uuid"
                clickable
                v-ripple
                @click="
                    () => {
                        if (!searchEnabled) return;
                        searchEnabled = false;
                        model = null;
                    }
                    //
                    //     // verify if the group is already in the list
                    //     if (
                    //         accessRights?.find((g) => g.uuid === props.opt.uuid)
                    //     )
                    //         return;
                    //
                    //     accessRights = accessRights?.concat([
                    //         {
                    //             uuid: props.opt.uuid,
                    //             name: props.opt.name,
                    //             rights: AccessGroupRights.READ,
                    //             memberCount: props.opt.memberCount,
                    //         },
                    //     ]) || [
                    //         {
                    //             uuid: props.opt.uuid,
                    //             name: props.opt.name,
                    //             rights: AccessGroupRights.READ,
                    //             memberCount: props.opt.memberCount,
                    //         },
                    //     ];
                    // }
                "
            >
                <q-item-section>
                    <q-item-label>
                        <q-icon
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
                            <span> ({{ props.opt.memberCount }} members) </span>
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
        :columns="selectedActionTemplateDisplayHeader"
        :rows="accessRights?.sort((a, b) => b.name.localeCompare(a.name)) || []"
        hide-pagination
        flat
        separator="horizontal"
        bordered
        style="margin-top: 6px"
        binary-state-sort
    >
        <template v-slot:body-cell-name="props">
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

        <template v-slot:body-cell-rights="props">
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
                            @click="updateRights(props.row, option)"
                        >
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
    </q-table>
</template>
<script setup lang="ts">
import { getAccessRightDescription } from 'src/services/generic';
import { QSelect, QTable } from 'quasar';
import { computed, ref } from 'vue';
import { AccessRight } from 'src/services/queries/project';
import {
    AccessGroupRights,
    accessGroupRightsList,
} from 'src/enums/ACCESS_RIGHTS';
import { useQuery } from '@tanstack/vue-query';
import { searchAccessGroups } from 'src/services/queries/access';
import { ActionTemplate } from 'src/types/ActionTemplate';

const actionTemplates = defineModel<ActionTemplate[]>();

const groupSearch = ref('');
const searchEnabled = ref(false);
const model = ref(null);

const selectedActionTemplateDisplayHeader = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        sortable: true,
    },
    {
        name: 'actions',
        required: true,
        label: 'Actions',
        align: 'center',
    },
];

const updateRights = (group: AccessRight, right: AccessGroupRights) => {
    accessRights.value =
        accessRights.value?.map((g) => {
            if (g.name === group.name) {
                return { ...g, rights: right };
            }
            return g;
        }) || [];
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

const searchResults = computed(() => {
    const results: AccessRight[] = [];

    foundAccessGroups.value?.[0].forEach((group) => {
        results.push({
            uuid: group.uuid,
            name: group.name,
            rights: null,
            memberCount: group.accessGroupUsers.length || 0,
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
