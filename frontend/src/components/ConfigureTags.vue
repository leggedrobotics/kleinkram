<template>
    <div class="row">
        <div class="col-9">
            <q-select
                v-model="_selected"
                @input-value="
                    (val) => {
                        tagSearch = val;
                    }
                "
                use-input
                multiple
                input-debounce="100"
                :options="tags"
                option-label="name"
            >
                <template v-slot:no-option>
                    <q-item>
                        <q-item-section class="text-grey">
                            No results
                        </q-item-section>
                    </q-item>
                </template>
                <template v-slot:selected-item="scope">
                    <q-chip
                        removable
                        @remove="scope.removeAtIndex(scope.index)"
                        :tabindex="scope.tabindex"
                        :icon="icon(scope.opt.type)"
                    >
                        {{ scope.opt.name }}
                    </q-chip>
                </template>
                <template v-slot:option="{ itemProps, opt }">
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
import DatatypeSelectorButton from 'components/buttons/DatatypeSelectorButton.vue';
import { computed, Ref, ref, watch } from 'vue';
import { TagType } from 'src/types/TagType';
import { DataType } from 'src/enums/TAG_TYPES';
import { useQuery } from '@tanstack/vue-query';
import { getFilteredTagTypes } from 'src/services/queries/tag';
const tagSearch = ref('');
const selectedDataType = ref(DataType.ANY);
const props = defineProps<{
    selected: TagType[];
}>();

const _selected = ref([...props.selected]);

const emits = defineEmits(['update:selected']);

watch(
    _selected,
    (newValue: any) => {
        emits('update:selected', newValue);
    },
    { deep: true },
);

const queryKey = computed(() => [
    'tags',
    tagSearch.value,
    selectedDataType.value,
]);
const { data: tags } = useQuery({
    queryKey: queryKey,
    queryFn: async () => {
        return getFilteredTagTypes(tagSearch.value, selectedDataType.value);
    },
});
</script>

<style scoped></style>
