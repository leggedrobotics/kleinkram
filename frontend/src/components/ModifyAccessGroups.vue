<template>
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
    <div class="row" v-for="user in foundUsers">
        <div class="col-4 flex flex-center">
            {{ user.name }}
        </div>
        <div class="col-4 flex flex-center">
            {{ user.email }}
        </div>
        <div class="col-2 flex flex-center">
            <q-select
                v-model="rights[user.uuid]"
                :options="options"
                style="width: 100%"
            />
        </div>
        <div class="col-2 flex flex-center">
            <q-btn
                label="Update"
                color="primary"
                @click="() => addUserToProject(user.uuid)"
                :disable="
                    !rights[user.uuid] ||
                    rights[user.uuid].value === AccessGroupRights.NONE
                "
            />
        </div>
    </div>
    <div class="row">
        <b>Access Groups</b>
    </div>
    <div class="row" v-for="accessGroup in foundAccessGroups">
        <div class="col-8 flex flex-center">
            {{ accessGroup.name }}
        </div>
        <div class="col-2 flex flex-center">
            <q-select v-model="rights[accessGroup.uuid]" :options="options" />
        </div>
        <div class="col-2 flex flex-center">
            <q-btn
                label="Update"
                color="primary"
                @click="() => addAccessGroupToProject(accessGroup.uuid)"
                :disable="
                    !rights[accessGroup.uuid] ||
                    rights[accessGroup.uuid].value === AccessGroupRights.NONE
                "
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { AccessGroupRights } from 'src/enums/ACCESS_RIGHTS';
import { computed, Ref, ref } from 'vue';
import { accessGroupRightsMap } from 'src/services/generic';
import { useQuery } from '@tanstack/vue-query';
import { searchUsers } from 'src/services/queries/user';
import { searchAccessGroups } from 'src/services/queries/access';

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
const { data: foundAccessGroups } = useQuery({
    queryKey: searchAccessGroupsKey,
    queryFn: () => searchAccessGroups(search.value),
});

function addAccessGroupToProject(accessGroupUUID: string) {
    emit('addAccessGroupToProject', {
        accessGroupUUID,
        rights: rights.value[accessGroupUUID].value,
    });
}

function addUserToProject(userUUID: string) {
    emit('addUsersToProject', {
        userUUID,
        rights: rights.value[userUUID].value,
    });
}
</script>

<style scoped></style>
