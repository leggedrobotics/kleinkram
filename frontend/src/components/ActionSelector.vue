<template>
    <q-select
        outlined
        hide-dropdown-icon
        v-model="model"
        use-input
        hide-selected
        fill-input
        input-debounce="300"
        placeholder="Search"
        :options="
            actionTemplates ? [newActionTemplate, ...actionTemplates] : []
        "
        @input-value="
            (e) => {
                updateCreateTemplateName(e);
            }
        "
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
                        updateSelectedTemplate(props.opt);
                    }

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
                            name="sym_o_terminal"
                            class="q-mr-sm"
                            style="
                                background-color: #e8e8e8;
                                padding: 6px;
                                border-radius: 50%;
                            "
                        />

                        {{ props.opt.name }}

                        <span> v{{ props.opt.version }} </span>
                    </q-item-label>
                </q-item-section>
            </q-item>
        </template>
    </q-select>

    <q-table
        class="table-white"
        :columns="selectedActionTemplateDisplayHeader"
        :rows="selectedTemplate || []"
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
                    name="sym_o_terminal"
                    class="q-mr-sm"
                    style="
                        background-color: #e8e8e8;
                        padding: 6px;
                        border-radius: 50%;
                    "
                />

                {{ props.row.name }}
            </q-td>
        </template>

        <template v-slot:body-cell-version="props">
            <q-td :props="props"> v{{ props.row.version }}</q-td>
        </template>
    </q-table>
</template>
<script setup lang="ts">
import { getAccessRightDescription } from 'src/services/generic';
import { QSelect, QTable } from 'quasar';
import { computed, Ref, ref } from 'vue';
import { AccessRight } from 'src/services/queries/project';
import {
    AccessGroupRights,
    accessGroupRightsList,
} from 'src/enums/ACCESS_RIGHTS';
import { useQuery } from '@tanstack/vue-query';
import { searchAccessGroups } from 'src/services/queries/access';
import { ActionTemplate } from 'src/types/ActionTemplate';

const DEFAULT_ACTION_TEMPLATE: ActionTemplate = new ActionTemplate(
    '',
    null,
    null,
    'rslethz/action:simple-dev',
    null,
    '',
    1,
    '',
    2,
    2,
    -1,
    2,
    '',
    AccessGroupRights.READ,
);
const actionTemplates = defineModel<ActionTemplate[]>();
const selectedTemplate: Ref<ActionTemplate[] | []> = ref([]);

console.log('PRINTING');
actionTemplates.value?.forEach((t) => {
    console.log(t);
});

const groupSearch = ref('');
const searchEnabled = ref(false);
const model = ref(null);
const newActionTemplate = ref(DEFAULT_ACTION_TEMPLATE);

function updateSelectedTemplate(selTempl: ActionTemplate) {
    selectedTemplate.value = [selTempl];
}

const selectedActionTemplateDisplayHeader = [
    {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        sortable: true,
    },
    {
        name: 'version',
        required: true,
        label: 'Version',
        align: 'center',
    },
];

function updateCreateTemplateName(e) {
    console.log(e);
    newActionTemplate.value.name = e + ' (new Template)';
}

//update selection Field
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
    const results: ActionTemplate[] = [];

    foundAccessGroups.value?.[0].forEach((group) => {
        results.push({
            uuid: group.uuid,
            name: group.name,
        });
    });

    foundUsers.value?.[0].forEach((group) => {
        results.push({
            uuid: group.uuid,
            name: group.name,
        });
    });

    return results;
});

const enableSearch = () => {
    searchEnabled.value = true;
};
</script>

<style scoped></style>
