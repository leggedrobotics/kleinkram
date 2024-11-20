<template>
    <q-select
        v-if="selected"
        v-model="selected"
        multiple
        clearable
        dense
        option-label="name"
        option-value="uuid"
        :options="categories"
        placeholder="Select Categories"
        use-input
        input-debounce="300"
        @clear="selected = []"
        @input-value="filter = $event"
    >
        <template #selected-item="props">
            <q-chip
                v-if="props.opt"
                removable
                :color="hashUUIDtoColor(props.opt.uuid)"
                style="color: white; font-size: smaller"
                @remove="props.removeAtIndex(props.index)"
            >
                {{ props.opt.name }}
            </q-chip>
        </template>
        <template #option="props">
            <q-item
                v-ripple
                clickable
                v-bind="props.itemProps"
                dense
                @click="props.toggleOption(props.opt)"
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
