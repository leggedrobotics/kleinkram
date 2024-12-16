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
            (val) => {
                filterActionTemplates(val);
                enableSearch();
            }
        "
        class="q-pb-md"
        autocomplete=""
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
                        <!-- Rendering templates icon in green if preexisting and yellow if newTemplate -->
                        <template v-if="props.opt.uuid === ''">
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

    <q-table
        class="table-white"
        :columns="selectionFieldHeader as any[]"
        :rows="selectedTemplate ? [selectedTemplate] : []"
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
                    name="sym_o_terminal"
                    class="q-mr-sm"
                    style="
                        background-color: #e8e8e8;
                        padding: 6px;
                        border-radius: 50%;
                    "
                />
                <span>{{ props.row.name }}</span>
            </q-td>
        </template>

        <template v-slot:body-cell-version="props">
            <q-td :props="props"> v{{ props.row.version }}</q-td>
        </template>
        <!--    option for empty table-->
        <template v-slot:no-data
            >Find an Action in the Field above (or create a new one)
        </template>
    </q-table>
</template>
<script setup lang="ts">
import { QSelect, QTable } from 'quasar';
import { computed, Ref, ref } from 'vue';
import { ActionTemplateDto } from '@api/types/actions/action-template.dto';
import { AccessGroupRights } from '@common/enum';

//gets passed as input
const { actionTemplates } = defineProps<{
    actionTemplates: ActionTemplateDto[];
}>();

//template that gets written
const selectedTemplate = defineModel<ActionTemplateDto>();

//clone templates to filter
const filteredActionTemplates: Ref<ActionTemplateDto[]> = ref([]);
filteredActionTemplates.value = actionTemplates ? [...actionTemplates] : [];

//removing newTemplate Option if Name in search field exactly matches existing template
const options = computed(() => {
    let suggestedName: string | undefined = newActionTemplate.value?.name;
    if (suggestedName === undefined) {
        return [...filteredActionTemplates.value];
    }
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
const newActionTemplate = ref<ActionTemplateDto>({
    accessRights: AccessGroupRights.READ,
    command: '',
    cpuCores: 1,
    cpuMemory: 2,
    entrypoint: '',
    gpuMemory: -1,
    imageName: '',
    maxRuntime: 10,
    name: '',
    version: '1',
    uuid: '',
});

function filterActionTemplates(val: string) {
    filteredActionTemplates.value = actionTemplates.filter((temp) => {
        return temp.name.includes(val);
    });
}

function updateSelectedTemplate(selTempl: ActionTemplateDto) {
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
