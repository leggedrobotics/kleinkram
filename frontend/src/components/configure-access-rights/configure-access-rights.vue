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
        autocomplete="false"
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
        <template v-if="searchEnabled && searchResults.length > 0" #no-option>
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
                                ...props.opt,
                                rights: AccessGroupRights.READ,
                            },
                        ]) || [
                            {
                                ...props.opt,
                                rights: AccessGroupRights.READ,
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
                            v-if="props.opt.type !== AccessGroupType.PRIMARY"
                            name="sym_o_group"
                            class="q-mr-sm"
                            style="
                                background-color: #e8e8e8;
                                padding: 6px;
                                border-radius: 50%;
                            "
                        />
                        <q-icon
                            v-if="props.opt.type === AccessGroupType.PRIMARY"
                            name="sym_o_person"
                            class="q-mr-sm"
                            style="
                                background-color: #e8e8e8;
                                padding: 6px;
                                border-radius: 50%;
                            "
                        />

                        {{ props.opt.name }}
                        <template
                            v-if="props.opt.type !== AccessGroupType.PRIMARY"
                        >
                            <span
                                :class="{
                                    'help-text': !accessRights?.find(
                                        (g) => g.uuid === props.opt.uuid,
                                    ),
                                }"
                            >
                                ({{ props.opt.memberCount }}
                                {{
                                    props.opt.memberCount === 1
                                        ? 'member'
                                        : 'members'
                                }})
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
                    v-if="props.row.type !== AccessGroupType.PRIMARY"
                    name="sym_o_group"
                    class="q-mr-sm"
                    style="
                        background-color: #e8e8e8;
                        padding: 6px;
                        border-radius: 50%;
                    "
                />
                <q-icon
                    v-if="props.row.type === AccessGroupType.PRIMARY"
                    name="sym_o_person"
                    class="q-mr-sm"
                    style="
                        background-color: #e8e8e8;
                        padding: 6px;
                        border-radius: 50%;
                    "
                />
                {{ props.row.name }}
                <span
                    v-if="props.row.type !== AccessGroupType.PRIMARY"
                    class="help-text"
                >
                    ({{ props.row.memberCount }}
                    {{ props.row.memberCount === 1 ? 'member' : 'members' }})
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
                        minAccessRights.some((r) => r.uuid === props.row.uuid)
                    "
                    :text-color="
                        minAccessRights.some((r) => r.uuid === props.row.uuid)
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
import { getAccessRightDescription } from '../../services/generic';
import { QSelect, QTable } from 'quasar';
import { computed, ref } from 'vue';
import { AccessGroupRights, AccessGroupType } from '@common/enum';
import { accessGroupRightsList } from '../../enums/accessGroupRightsList';
import { useSearchAccessGroup } from '../../hooks/query-hooks';
import { AccessGroupDto } from '@api/types/User.dto';
import { DefaultRightDto } from '@api/types/access-control/default-right.dto';

const { minAccessRights } = defineProps<{
    minAccessRights: DefaultRightDto[];
}>();
const accessRights = defineModel<DefaultRightDto[]>();

const sortedAccessRights = computed(() =>
    [...(accessRights.value ?? [])].sort((a, b) =>
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

const updateRights = (
    group: AccessGroupDto,
    right: AccessGroupRights,
): void => {
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
        }) && [];
};

const removeGroup = (group: AccessGroupDto): void => {
    if (minAccessRights.some((r) => r.uuid === group.uuid)) {
        console.log('Cannot remove minimum access group');
        return;
    }

    accessRights.value = accessRights.value?.filter(
        (g) => g.name !== group.name,
    );
};

const { data: foundAccessGroups } = useSearchAccessGroup(groupSearch);

const isBelowMinRights = (
    group: AccessGroupDto,
    right: AccessGroupRights,
): boolean => {
    const minAccess = minAccessRights.find((r) => r.uuid === group.uuid);
    if (minAccess === undefined) return false;
    return minAccess.rights > right;
};

const searchResults = computed<AccessGroupDto[]>(() => {
    if (foundAccessGroups.value !== undefined) {
        return foundAccessGroups.value.data;
    }

    return [] as AccessGroupDto[];
});

const enableSearch = (): void => {
    searchEnabled.value = true;
};
</script>

<style scoped></style>
