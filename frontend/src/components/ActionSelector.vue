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
        :options="options"
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
                filterActionTemplates(val);
                enableSearch();
                update();
            }
        "
        class="q-pb-md"
    >
        <!--    Search Icon at end of field-->
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
                        updateSelectedTemplate(props.opt.clone());
                    }
                "
            >
                <q-item-section>
                    <q-item-label>
                        <!--                    Rendering templates icon in green if preexisting and yellow if newTemplate-->
                        <template v-if="props.opt.createdBy === null">
                            <q-icon
                                name="sym_o_terminal"
                                class="q-mr-sm"
                                style="
                                    background-color: orange;
                                    padding: 6px;
                                    border-radius: 50%;
                                "
                            />
                            <span>{{ props.opt.name }}</span>
                            <span>
                                v{{ props.opt.version }} (new Template)
                            </span>
                        </template>
                        <template v-else>
                            <q-icon
                                name="sym_o_terminal"
                                class="q-mr-sm"
                                style="
                                    background-color: lightgreen;
                                    padding: 6px;
                                    border-radius: 50%;
                                "
                            />
                            <span>{{ props.opt.name }}</span>
                            <span> v{{ props.opt.version }} </span>
                        </template>
                    </q-item-label>
                </q-item-section>
            </q-item>
        </template>
    </q-select>

    <q-list
        class="bg-orange rounded-borders"
        v-if="selectedTemplate && selectedTemplate.createdBy == null"
    >
        <q-item clickable v-ripple>
            <q-item-section avatar top>
                <q-avatar icon="sym_o_terminal"></q-avatar>
            </q-item-section>

            <q-item-section>
                <q-item-label lines="1"
                    >{{ selectedTemplate.name }} v{{ selectedTemplate.version }}
                </q-item-label>
                <q-item-label caption> new Template </q-item-label>
            </q-item-section>

            <q-item-section side>
                <q-icon name="sym_o_info"></q-icon>
            </q-item-section>
        </q-item>
    </q-list>

    <q-list
        class="bg-light-green-14 rounded-borders"
        v-else-if="selectedTemplate"
    >
        <q-item clickable v-ripple>
            <q-item-section avatar top>
                <q-avatar icon="sym_o_terminal"></q-avatar>
            </q-item-section>

            <q-item-section>
                <q-item-label lines="1"
                    >{{ selectedTemplate.name }} v{{ selectedTemplate.version }}
                </q-item-label>
                <q-item-label caption>
                    created: {{ selectedTemplate.createdAt }}
                </q-item-label>
            </q-item-section>

            <q-item-section side>
                <q-icon name="sym_o_info"></q-icon>
            </q-item-section>
        </q-item>
    </q-list>

    <q-list class="bg-red-2 rounded-borders" v-else>
        <q-item clickable v-ripple>
            <q-item-section avatar top>
                <q-avatar icon="sym_o_terminal"></q-avatar>
            </q-item-section>

            <q-item-section>
                <q-item-label lines="1">An action needs a name</q-item-label>
                <q-item-label caption></q-item-label>
            </q-item-section>

            <q-item-section side>
                <q-icon name="sym_o_info"></q-icon>
            </q-item-section>
        </q-item>
    </q-list>
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
//gets passed as input
const { actionTemplates } = defineProps<{
    actionTemplates: ActionTemplate[];
}>();
//template that gets written
const selectedTemplate = defineModel<ActionTemplate>();

//clone templates to filter
const filteredActionTemplates: Ref<ActionTemplate[] | []> = ref([]);
filteredActionTemplates.value = actionTemplates ? [...actionTemplates] : [];

//removing newTemplate Option if Name in search field exactly matches existing template
const options = computed(() => {
    let suggestedName: string = newActionTemplate.value.name;
    let filteredNames: string[] = filteredActionTemplates.value.map(
        (x) => x.name,
    );

    if (filteredNames.includes(suggestedName)) {
        return [...filteredActionTemplates.value];
    } else {
        return [newActionTemplate.value, ...filteredActionTemplates.value];
    }
});

const searchEnabled = ref(false);
const model = ref(null);
const newActionTemplate = ref(DEFAULT_ACTION_TEMPLATE);

function filterActionTemplates(val: string) {
    if (!actionTemplates) {
        throw new Error('actionTemplates undefined in filterActionTemplates');
        if (!actionTemplates) {
            throw new Error(
                'actionTemplates.value undefined in filterActionTemplates',
            );
        }
    }

    filteredActionTemplates.value =
        actionTemplates?.filter((temp) => {
            return temp.name.includes(val);
        }) || [];
}

function updateSelectedTemplate(selTempl: ActionTemplate) {
    selectedTemplate.value = selTempl;
}

const selectionFieldHeader = [
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

function updateCreateTemplateName(newName: string) {
    newActionTemplate.value.name = newName;
}

const enableSearch = () => {
    searchEnabled.value = true;
};
</script>

<style scoped></style>
