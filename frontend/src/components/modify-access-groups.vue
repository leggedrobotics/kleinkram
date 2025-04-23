<template>
    <div>
        <div class="row" style="padding-top: 12px">
            <div class="col-10">
                <q-input
                    v-model="search"
                    label="Search User / Access Group"
                    debounce="300"
                />
            </div>
        </div>
        <div class="row" style="margin-top: 15px">
            <b>Individual Users</b>
        </div>
        <q-table
            v-if="foundUsers && foundUsers.count > 0"
            :rows="(foundUsers as any) || ([] as any)"
            :columns="columns as any"
            hide-bottom
            flat
            bordered
        >
            <template #body-cell-name="_props">
                <q-td :props="_props" style="width: 150px">
                    {{ _props.row.name }}
                </q-td>
            </template>
            <template #body-cell-rights="_props">
                <q-td :props="_props" style="width: 150px">
                    <q-select
                        v-model="rights[_props.row.uuid]"
                        :options="options"
                        @update:model-value="
                            () =>
                                addUserToProject(
                                    _props.row.uuid,
                                    _props.row.name,
                                )
                        "
                    />
                </q-td>
            </template>
        </q-table>

        <div class="row">
            <b>Access Groups</b>
        </div>
        <q-table
            v-if="foundAccessGroups && foundAccessGroups.length > 0"
            :rows="foundAccessGroups || []"
            :columns="columns as any"
            hide-bottom
            flat
            bordered
            binary-state-sort
        >
            <template #body-cell-name="_props">
                <q-td :props="_props" style="width: 150px">
                    {{ _props.row.name }}
                </q-td>
            </template>
            <template #body-cell-rights="_props">
                <q-td :props="_props" style="width: 150px">
                    <q-select
                        v-model="rights[_props.row.uuid]"
                        :options="options"
                        @update:model-value="
                            () =>
                                addAccessGroupToProject(
                                    _props.row.uuid,
                                    _props.row.name,
                                )
                        "
                    />
                </q-td>
            </template>
        </q-table>
    </div>
</template>

<script setup lang="ts">
import { computed, Ref, ref } from 'vue';
import { accessGroupRightsMap } from 'src/services/generic';
import { QTable } from 'quasar';
import { AccessGroupRights } from '@common/enum';
import { useSearchAccessGroup, useUserSearch } from 'src/hooks/query-hooks';

import { AccessGroupsDto } from '@api/types/access-control/access-groups.dto';

const properties = defineProps<{
    existingRights: Record<string, { label: string; value: AccessGroupRights }>;
}>();
const emit = defineEmits(['addAccessGroupToProject', 'addUsersToProject']);

const search = ref('');
const options = Object.keys(accessGroupRightsMap).map((key) => ({
    label: accessGroupRightsMap[Number.parseInt(key, 10) as AccessGroupRights],
    value: Number.parseInt(key, 10),
}));
const rights: Ref<Record<string, { label: string; value: AccessGroupRights }>> =
    ref({ ...properties.existingRights });

const { data: foundUsers } = useUserSearch(search);

const { data: _foundAccessGroups } = useSearchAccessGroup(search);
const foundAccessGroups = computed(() =>
    _foundAccessGroups.value
        ? _foundAccessGroups.value.data
        : ([] as AccessGroupsDto[]),
);

function addAccessGroupToProject(accessGroupUUID: string, name: string) {
    emit('addAccessGroupToProject', {
        accessGroupUUID,
        rights: rights.value[accessGroupUUID]?.value,
        name,
    });
}

function addUserToProject(userUUID: string, name: string) {
    emit('addUsersToProject', {
        userUUID,
        rights: rights.value[userUUID]?.value,
        name,
    });
}

const columns = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
    },
    {
        name: 'rights',
        required: true,
        label: 'Rights',
        align: 'left',
        field: 'rights',
        format: (value: string) => value,
    },
];
</script>

<style scoped></style>
