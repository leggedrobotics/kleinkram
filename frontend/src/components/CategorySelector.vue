<template>
    <q-select
        v-model="selected"
        v-if="selected"
        multiple
        clearable
        dense
        option-label="name"
        option-value="uuid"
        :options="categories"
        placeholder="Select Categories"
        use-input
        @clear="selected = []"
        input-debounce="300"
        @input-value="filter = $event"
    >
        <template v-slot:selected-item="props">
            <q-chip
                v-if="props.opt"
                removable
                @remove="props.removeAtIndex(props.index)"
                :color="hashUUIDtoColor(props.opt.uuid)"
                style="color: white; font-size: smaller"
            >
                {{ props.opt.name }}
            </q-chip>
        </template>
        <template v-slot:option="props">
            <q-item
                clickable
                v-ripple
                v-bind="props.itemProps"
                @click="props.toggleOption(props.opt)"
                dense
            >
                <q-item-section>
                    <div>
                        <q-chip
                            dense
                            :color="hashUUIDtoColor(props.opt.uuid)"
                            :style="`color: white `"
                        >
                            {{ props.opt.name }}
                        </q-chip>
                    </div>
                </q-item-section>
            </q-item>
        </template>
    </q-select>
</template>
<script setup lang="ts">
import { hashUUIDtoColor } from 'src/services/generic';
import { computed, ref, Ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { Category } from 'src/types/Category';
import { getCategories } from 'src/services/queries/categories';

const props = defineProps<{
    selected: Ref<Category[]>;
    project_uuid: string;
}>();

const emit = defineEmits(['update:selected']);

const filter = ref('');
const selected = computed({
    get: () => props.selected,
    set: (value: Category[]) => emit('update:selected', value),
});

const queryKey = computed(() => [
    'categories',
    props.project_uuid,
    filter.value,
]);
const { data: _categories } = useQuery<[Category[], number]>({
    queryKey: queryKey,
    queryFn: () => getCategories(props.project_uuid, filter.value),
});

const categories: Ref<Category[]> = computed(() =>
    _categories.value ? _categories.value[0] : [],
);
</script>

<style scoped></style>
