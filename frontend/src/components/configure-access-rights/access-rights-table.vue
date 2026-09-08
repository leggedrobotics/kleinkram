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
                            :disable="isDisabledRightOption(props.row, option)"
                            @click="
                                () => emit('update-rights', props.row, option)
                            "
                        >
                            <q-tooltip
                                v-if="isDisabledRightOption(props.row, option)"
                            >
                                Project must have at least one group with Delete
                                rights.
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
                    :disable="isDeleteDisabled(props.row)"
                    @click="() => emit('remove', props.row)"
                >
                    <q-tooltip v-if="isDeleteDisabled(props.row)">
                        Cannot remove the last group with Delete rights.
                    </q-tooltip>
                </q-btn>
            </q-td>
        </template>
    </q-table>
</template>

<script setup lang="ts">
import type { DefaultRightDto } from '@kleinkram/api-dto/types/access-control/default-right.dto';
import { AccessGroupRights, AccessGroupType } from '@kleinkram/shared';
import AccessGroupAvatar from 'components/configure-access-rights/access-group-avatar.vue';
import { QTableColumn } from 'quasar';
import { accessGroupRightsList } from 'src/enums/access-group-rights-list';
import { getAccessRightDescription } from 'src/services/generic';
import { computed } from 'vue';

const properties = defineProps<{
    accessRights: DefaultRightDto[];
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
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `${count} member${count === 1 ? '' : 's'}`;

/**
 * There is only one global rule for the access rights of a project:
 * **There must always be at least one group with DELETE rights.**
 *
 * The same global rule is enforced in the backend (see access.service.ts). We implement it here as well to provide immediate feedback to the user and prevent unnecessary API calls that would be rejected by the backend.
 */

// Count how many groups currently have DELETE rights
const deleteGroupCount = computed(() => {
    return properties.accessRights.filter(
        (g) => g.rights === AccessGroupRights.DELETE,
    ).length;
});

//Prevent downgrading the last group with DELETE rights
const isDisabledRightOption = (
    group: DefaultRightDto,
    rightOption: AccessGroupRights,
): boolean => {
    // If they are trying to select a right lower than DELETE...
    if (
        group.rights === AccessGroupRights.DELETE &&
        rightOption < AccessGroupRights.DELETE
    ) {
        // ...disable it if this is the ONLY group with DELETE rights
        return deleteGroupCount.value <= 1;
    }
    return false;
};

//Prevent removing the last group with DELETE rights
const isDeleteDisabled = (group: DefaultRightDto): boolean => {
    if (group.rights === AccessGroupRights.DELETE) {
        return deleteGroupCount.value <= 1;
    }
    return false;
};
</script>
