<template>
    <div>
        <span class="help-text">
            Metadata are optional or enforced key-value pairs that are attached
            to every mission within the project, e.g. the 'location' of the
            mission.
        </span>

        <div class="col-9">
            <q-select
                v-model="selected"
                use-input
                multiple
                input-debounce="100"
                :options="tags?.data"
                option-label="name"
                @input-value="onInputUpdate"
            >
                <template #no-option>
                    <q-item>
                        <q-item-section class="text-grey">
                            No results
                        </q-item-section>
                    </q-item>
                </template>
                <template #selected-item="scope">
                    <q-chip
                        removable
                        :tabindex="scope.tabindex"
                        :icon="icon(scope.opt.type)"
                        @remove="() => scope.removeAtIndex(scope.index)"
                    >
                        {{ scope.opt.name }}
                    </q-chip>
                </template>
                <template #option="{ itemProps, opt }">
                    <q-item v-bind="itemProps">
                        <q-item-section>
                            <q-item-label v-html="opt.name" />
                        </q-item-section>
                        <q-item-section side>
                            <q-icon :name="icon(opt.type)" class="q-mr-sm" />
                        </q-item-section>
                    </q-item>
                </template>
            </q-select>
        </div>
        <div class="col-3">
            <DatatypeSelectorButton v-model="selectedDataType" />
        </div>
    </div>
</template>
<script setup lang="ts">
import { icon } from 'src/services/generic';
import { ref, watch } from 'vue';
import { DataType } from '@common/enum';
import { useFilteredTag } from '../hooks/query-hooks';
import { TagTypeDto } from '@api/types/tags/tags.dto';
import DatatypeSelectorButton from './buttons/datatype-select-button.vue';

const tagSearch = ref('');
const selectedDataType = ref(DataType.ANY);
const properties = defineProps<{
    selected: TagTypeDto[];
}>();

const selected = ref([...properties.selected]);

const emits = defineEmits(['update:selected']);

watch(
    selected,
    (newValue: any) => {
        emits('update:selected', newValue);
    },
    { deep: true },
);

const { data: tags } = useFilteredTag(tagSearch.value, selectedDataType.value);

const onInputUpdate = (value: string) => {
    tagSearch.value = value;
};
</script>

<style scoped></style>
