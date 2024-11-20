<template>
    <div class="flex">
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
            flat
            label="Add"
            icon="sym_o_add"
            style="width: 20%"
            :disable="!newCategory || newCategory.length < 2"
            @click="addCategory"
        />
    </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { createCategory } from 'src/services/mutations/categories';
import { Notify } from 'quasar';
import { useMutation, useQueryClient } from '@tanstack/vue-query';

const props = defineProps<{
    project_uuid: string;
}>();
const queryClient = useQueryClient();

const newCategory = ref('');
const { mutate } = useMutation({
    mutationFn: (category: string) =>
        createCategory(category, props.project_uuid),
    onSuccess: () => {
        queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'categories',
        });
        Notify.create({
            message: 'Category added',
            color: 'positive',
            location: 'bottom',
        });
    },
    onError: (error: Error) =>
        Notify.create({
            message: error.message,
            color: 'negative',
            location: 'bottom',
        }),
});

function addCategory() {
    if (newCategory.value && newCategory.value.length >= 2) {
        mutate(newCategory.value.trim());
        newCategory.value = '';
    }
}
</script>
<style scoped></style>
