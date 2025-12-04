<template>
    <q-table
        class="table-white q-mt-xs"
        :columns="columns"
        :rows="accessRights"
        hide-pagination
        flat
        separator="horizontal"
        bordered
        style="max-height: 360px"
        binary-state-sort
        :rows-per-page-options="[0]"
    >
        <template #body-cell-name="props">
            <q-td :props="props">
                <div class="row items-center no-wrap">
                    <AccessGroupAvatar :type="props.row.type" />

                    <div class="column">
                        <span style="font-size: 1.2em">{{
                            props.row.name
                        }}</span>
                        <span
                            v-if="props.row.type !== AccessGroupType.PRIMARY"
                            class="text-caption text-grey"
                        >
                            {{ formatMemberCount(props.row.memberCount) }}
                        </span>
                    </div>
                </div>
            </q-td>
        </template>

        <template #body-cell-rights="props">
            <q-td :props="props">
                <q-btn-dropdown
                    flat
                    outlined
                    class="bg-grey-3"
                    :label="getAccessRightDescription(props.row.rights)"
                    auto-close
                >
                    <q-list>
                        <q-item
                            v-for="option in accessGroupRightsList"
                            :key="option"
                            clickable
                            :disable="isBelowMinRights(props.row, option)"
                            @click="
                                () => emit('update-rights', props.row, option)
                            "
                        >
                            <q-tooltip
                                v-if="isBelowMinRights(props.row, option)"
                            >
                                {{ getMinRightsTooltip(props.row) }}
                            </q-tooltip>
                            <q-item-section>
                                {{ getAccessRightDescription(option) }}
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
                    color="red"
                    @click="() => emit('remove', props.row)"
                />
            </q-td>
        </template>
    </q-table>
</template>

<script setup lang="ts">
import { DefaultRightDto } from '@kleinkram/api-dto/types/access-control/default-right.dto';
import { AccessGroupRights, AccessGroupType } from '@kleinkram/shared';
import AccessGroupAvatar from 'components/configure-access-rights/access-group-avatar.vue';
import { QTableColumn } from 'quasar';
import { accessGroupRightsList } from 'src/enums/access-group-rights-list';
import { getAccessRightDescription } from 'src/services/generic';

const properties = defineProps<{
    accessRights: DefaultRightDto[];
    minAccessRights: DefaultRightDto[];
}>();

const emit = defineEmits<{
    (
        event: 'update-rights',
        group: DefaultRightDto,
        right: AccessGroupRights,
    ): void;
    (event: 'remove', group: DefaultRightDto): void;
}>();

const columns: QTableColumn<{
    name: string;
    rights: AccessGroupRights;
    actions: string;
}>[] = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        field: 'name',
    },
    {
        name: 'rights',
        required: true,
        label: 'Rights',
        align: 'left',
        field: 'rights',
    },
    {
        name: 'actions',
        required: true,
        label: '',
        align: 'center',
        field: 'actions',
    },
];

const formatMemberCount = (count: number): string =>
    `${count} member${count === 1 ? '' : 's'}`;

/**
 * Checks if a specific option is strictly lower than the user's minimum rights.
 * This enforces the constraint logic inside the dropdown.
 */
const isBelowMinRights = (
    group: DefaultRightDto,
    rightOption: AccessGroupRights,
): boolean => {
    const minAccess = properties.minAccessRights.find(
        (r) => r.uuid === group.uuid,
    );
    // If minAccess exists, the option is disabled if it is STRICTLY LESS than minAccess
    return minAccess ? minAccess.rights > rightOption : false;
};

const getMinRightsTooltip = (group: DefaultRightDto): string => {
    const minAccess = properties.minAccessRights.find(
        (r) => r.uuid === group.uuid,
    );
    if (!minAccess) return 'Option unavailable';
    return `Minimum access required: ${getAccessRightDescription(
        minAccess.rights,
    )}`;
};
</script>
