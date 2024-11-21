<template>
    <div>
        <span class="help-text">
            Metadata are optional or enforced key-value pairs that are attached
            to every mission within the project, e.g. the 'location' of the
            mission.
        </span>

        <div class="col-9">
            <q-select
                v-model="_selected"
                use-input
                multiple
                input-debounce="100"
                :options="tags"
                option-label="name"
                @input-value="
                    (val) => {
                        tagSearch = val;
                    }
                "
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
                        @remove="scope.removeAtIndex(scope.index)"
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
import DatatypeSelectorButton from 'components/buttons/DatatypeSelectorButton.vue';
import { computed, ref, watch } from 'vue';
import { DataType } from '@common/enum';
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
    'tagTypes',
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
