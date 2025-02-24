<template>
    <q-select
        v-model="model"
        outlined
        hide-dropdown-icon
        use-input
        hide-selected
        fill-input
        input-debounce="300"
        placeholder="Search"
        :options="options"
        class="q-pb-md"
        @input-value="updateCreateTemplateName"
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
    >
        <!--    Search Icon at end of field-->
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
                        updateSelectedTemplate(
                            JSON.parse(JSON.stringify(props.opt)),
                        );
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
        v-if="selectedTemplate && selectedTemplate.uuid == undefined"
        class="bg-orange rounded-borders"
    >
        <q-item v-ripple clickable>
            <q-item-section avatar top>
                <q-avatar icon="sym_o_terminal"></q-avatar>
            </q-item-section>

            <q-item-section>
                <q-item-label lines="1"
                    >{{ selectedTemplate.name }} v{{ selectedTemplate.version }}
                </q-item-label>
                <q-item-label caption> new Template</q-item-label>
            </q-item-section>

            <q-item-section side>
                <q-icon name="sym_o_info"></q-icon>
            </q-item-section>
        </q-item>
    </q-list>

    <q-list
        v-else-if="selectedTemplate"
        class="bg-light-green-14 rounded-borders"
    >
        <q-item v-ripple clickable>
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

    <q-list v-else class="bg-red-2 rounded-borders">
        <q-item v-ripple clickable>
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
import { QSelect } from 'quasar';
import { computed, Ref, ref } from 'vue';
import { ActionTemplateDto } from '@api/types/actions/action-template.dto';

const DEFAULT_ACTION_TEMPLATE: ActionTemplateDto = {};

//gets passed as input
const { actionTemplates } = defineProps<{
    actionTemplates: ActionTemplate[];
}>();

//template that gets written
const selectedTemplate = defineModel<ActionTemplateDto>();

//clone templates to filter
const filteredActionTemplates: Ref<ActionTemplateDto[] | []> = ref([]);
filteredActionTemplates.value = actionTemplates ? [...actionTemplates] : [];
//removing newTemplate Option if Name in search field exactly matches existing template
const options = computed(() => {
    const suggestedName: string = newActionTemplate.value.name;
    const filteredNames: string[] = filteredActionTemplates.value.map(
        (x) => x.name,
    );
    return filteredNames.includes(suggestedName)
        ? [...filteredActionTemplates.value]
        : [newActionTemplate.value, ...filteredActionTemplates.value];
});
const searchEnabled = ref(false);
const model = ref(null);
const newActionTemplate = ref(DEFAULT_ACTION_TEMPLATE);

function filterActionTemplates(value: string) {
    if (!actionTemplates) {
        throw new Error('actionTemplates undefined in filterActionTemplates');
        if (!actionTemplates) {
            throw new Error(
                'actionTemplates.value undefined in filterActionTemplates',
            );
        }
    }
    filteredActionTemplates.value =
        actionTemplates.filter((temporary) => {
            return temporary.name.includes(value);
        }) || [];
}

function updateSelectedTemplate(selTempl: ActionTemplateDto) {
    selectedTemplate.value = selTempl;
}

function updateCreateTemplateName(newName: string) {
    newActionTemplate.value.name = newName;
}

const enableSearch = () => {
    searchEnabled.value = true;
};
</script>

<style scoped></style>
