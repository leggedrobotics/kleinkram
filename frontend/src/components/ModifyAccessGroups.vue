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
            v-if="foundUsers && foundUsers.length > 0"
            :rows="foundUsers || []"
            :columns="columns"
            hide-bottom
            flat
            bordered
        >
            <template v-slot:body-cell-name="_props">
                <q-td :props="_props" style="width: 150px">
                    {{ _props.row.name }}
                </q-td>
            </template>
            <template v-slot:body-cell-rights="_props">
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
            :columns="columns"
            hide-bottom
            flat
            bordered
            binary-state-sort
        >
            <template v-slot:body-cell-name="_props">
                <q-td :props="_props" style="width: 150px">
                    {{ _props.row.name }}
                </q-td>
            </template>
            <template v-slot:body-cell-rights="_props">
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
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import { computed, Ref, ref } from 'vue';
import { accessGroupRightsMap } from 'src/services/generic';
import { useQuery } from '@tanstack/vue-query';
import { searchUsers } from 'src/services/queries/user';
import { searchAccessGroups } from 'src/services/queries/access';
import { QTable } from 'quasar';

const props = defineProps<{
    existingRights: Record<string, { label: string; value: AccessGroupRights }>;
}>();
const emit = defineEmits(['addAccessGroupToProject', 'addUsersToProject']);

const search = ref('');
const options = Object.keys(accessGroupRightsMap).map((key) => ({
    label: accessGroupRightsMap[parseInt(key, 10) as AccessGroupRights],
    value: parseInt(key, 10),
}));
const rights: Ref<Record<string, { label: string; value: AccessGroupRights }>> =
    ref({ ...props.existingRights });

const searchUsersKey = computed(() => ['users', search.value]);
const { data: foundUsers } = useQuery({
    queryKey: searchUsersKey,
    queryFn: () => searchUsers(search.value),
});

const searchAccessGroupsKey = computed(() => ['accessGroups', search.value]);
const enabled = computed(() => search.value.length >= 2);
const { data: _foundAccessGroups } = useQuery({
    queryKey: searchAccessGroupsKey,
    queryFn: () =>
        searchAccessGroups(search.value, false, false, false, 0, 100),
    enabled,
});
const foundAccessGroups = computed(() =>
    _foundAccessGroups.value ? _foundAccessGroups.value[0] : [],
);

function addAccessGroupToProject(accessGroupUUID: string, name: string) {
    emit('addAccessGroupToProject', {
        accessGroupUUID,
        rights: rights.value[accessGroupUUID].value,
        name,
    });
}

function addUserToProject(userUUID: string, name: string) {
    emit('addUsersToProject', {
        userUUID,
        rights: rights.value[userUUID].value,
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
        format: (val: string) => val,
    },
];
</script>

<style scoped></style>
