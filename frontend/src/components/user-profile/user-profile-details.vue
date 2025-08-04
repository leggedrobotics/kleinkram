<template>
    <div v-if="user" class="q-table-container">
        <table class="q-table__table">
            <tbody>
                <tr>
                    <td class="q-table__cell first-column">Name:</td>
                    <td class="q-table__cell">
                        <q-chip> {{ user.name }}</q-chip>
                    </td>
                </tr>
                <tr>
                    <td class="q-table__cell first-column">Email:</td>
                    <td class="q-table__cell">
                        <q-chip> {{ user.email }}</q-chip>
                    </td>
                </tr>
                <tr>
                    <td class="q-table__cell first-column">Role:</td>
                    <td class="q-table__cell">
                        <q-chip>{{ user.role }}</q-chip>
                    </td>
                </tr>
                <tr>
                    <td class="q-table__cell first-column">UUID:</td>
                    <td class="q-table__cell">
                        <q-chip> {{ user.uuid }}</q-chip>
                    </td>
                </tr>
                <tr>
                    <td class="q-table__cell first-column">
                        Affiliation Group:
                    </td>
                    <td class="q-table__cell">
                        <q-chip>{{ affiliationGroup?.name || 'None' }}</q-chip>
                    </td>
                </tr>
                <tr>
                    <td class="q-table__cell first-column">Primary Group:</td>
                    <td class="q-table__cell">
                        <q-chip>{{ primaryGroup?.name || 'None' }}</q-chip>
                    </td>
                </tr>

                <tr>
                    <td class="q-table__cell first-column">Custom Groups:</td>
                    <td class="q-table__cell">
                        <q-chip
                            v-for="group in user.memberships.filter(
                                (g: GroupMembershipDto) =>
                                    g.accessGroup?.type ===
                                    AccessGroupType.CUSTOM,
                            )"
                            :key="group.accessGroup?.uuid ?? group.uuid"
                            class="q-mr-sm"
                        >
                            {{ group.accessGroup?.name }}
                        </q-chip>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <div v-else>
        <div class="row flex-center">
            <q-spinner-gears size="100px" />
        </div>
    </div>
</template>
<script setup lang="ts">
import { GroupMembershipDto } from '@api/types/user.dto';
import { AccessGroupType } from '@common/enum';
import { useUser } from 'src/hooks/query-hooks';
import { computed } from 'vue';

const { data: user } = useUser();

const affiliationGroup = computed(
    () =>
        user.value?.memberships.find(
            (group: GroupMembershipDto) =>
                group.accessGroup?.type === AccessGroupType.AFFILIATION,
        )?.accessGroup,
);

const primaryGroup = computed(
    () =>
        user.value?.memberships.find(
            (group: GroupMembershipDto) =>
                group.accessGroup?.type === AccessGroupType.PRIMARY,
        )?.accessGroup,
);
</script>

<style>
.q-table-container {
    max-width: 100%;
    border: 1px solid #e0e0e0;
    border-bottom: none;
}

.q-table__table {
    width: 100%;
    border-collapse: collapse;
}

.q-table__cell {
    padding: 8px;
    border-bottom: none; /* Remove border to match page background */
    outline: black;
    border-bottom: 1px solid #e0e0e0;
    border-right: 1px solid #e0e0e0;
}

.q-table__cell:last-child {
    border-right: none;
}

.first-column {
    width: 130px;
}
</style>
