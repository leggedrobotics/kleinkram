<template>
    <q-select
        v-model="selected"
        multiple
        clearable
        use-chips
        option-label="name"
        option-value="uuid"
        :options="categories"
        @input-value="filter = $event"
        label="Select Categories"
        use-input
        @clear="selected = []"
        input-debounce="300"
    >
        <template v-slot:selected-item="props">
            <q-chip
                removable
                @remove="props.removeAtIndex(props.index)"
                :color="hashUUIDtoColor(props.opt.uuid)"
                style="color: white; font-size: smaller"
            >
                {{ props.opt.name }}
            </q-chip>
        </template>
    </q-select>
    <div class="flex q-my-lg">
        <q-input
            v-model="newCategory"
            class="q-ma-md q-py-md"
            style="width: 80%; padding-right: 10px"
            outlined
            dense
            placeholder="Add new category"
            @keyup.enter="addCategory"
        />
        <q-btn
            class="bg-button-primary q-my-md"
            label="Add"
            icon="sym_o_add"
            style="width: 20%"
            :disable="!newCategory || newCategory.length < 2"
            @click="addCategory"
        />
    </div>
</template>
<script setup lang="ts">
import { getCategories } from 'src/services/queries/categories';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, ref, Ref, watch } from 'vue';
import { Category } from 'src/types/Category';
import { FileEntity } from 'src/types/FileEntity';
import { createCategory } from 'src/services/mutations/categories';
import { Notify } from 'quasar';
import { hashUUIDtoColor } from 'src/services/generic';

const emit = defineEmits(['update:selected']);
const props = defineProps<{
    file: FileEntity;
}>();

const queryClient = useQueryClient();

const newCategory = ref('');
const selected = ref<Category[]>(props.file.categories || []);
const filter = ref('');

const queryKey = computed(() => [
    'categories',
    props.file.mission?.project?.uuid,
    filter.value,
]);
const { data: _categories } = useQuery<[Category[], number]>({
    queryKey: queryKey,
    queryFn: () =>
        getCategories(props.file.mission?.project.uuid, filter.value),
});

const { mutate } = useMutation({
    mutationFn: (category: string) =>
        createCategory(category, props.file.mission?.project?.uuid),
    onSuccess: () =>
        queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'categories',
        }),
    onError: (error: Error) =>
        Notify.create({
            message: error.message,
            color: 'negative',
            location: 'bottom',
        }),
});

function addCategory() {
    if (newCategory.value && newCategory.value.length >= 2) {
        console.log(newCategory.value);
        mutate(newCategory.value.trim());
        newCategory.value = '';
    }
}

const categories: Ref<Category[]> = computed(() =>
    _categories.value ? _categories.value[0] : [],
);

watch(
    () => selected.value,
    (value) => {
        emit('update:selected', value);
    },
);
</script>

<style scoped></style>
