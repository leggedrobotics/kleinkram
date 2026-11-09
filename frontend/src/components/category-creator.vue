<template>
    <div class="q-ma-md">
        <div class="flex">
            <q-input
                v-model="newCategory"
                class="q-py-md"
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
        <q-input
            v-model="newDescription"
            outlined
            dense
            type="textarea"
            autogrow
            input-style="min-height: 40px"
            placeholder="Description (optional)"
            hint="Explain what files belong into this category"
        />
    </div>
</template>
<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, QNotifyCreateOptions } from 'quasar';
import { createCategory } from 'src/services/mutations/categories';
import { ref } from 'vue';

const properties = defineProps<{
    projectUuid: string;
}>();
const queryClient = useQueryClient();

const newCategory = ref('');
const newDescription = ref('');
const { mutate } = useMutation({
    mutationFn: ({
        name,
        description,
    }: {
        name: string;
        description: string;
    }) => createCategory(name, properties.projectUuid, description),
    onSuccess: async () => {
        await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'categories',
        });
        Notify.create({
            message: 'Category added',
            color: 'positive',
            location: 'bottom',
        } as QNotifyCreateOptions);
    },
    onError: (error: Error) =>
        Notify.create({
            message: error.message,
            color: 'negative',
            location: 'bottom',
        } as QNotifyCreateOptions),
});

function addCategory() {
    if (newCategory.value && newCategory.value.length >= 2) {
        mutate({
            name: newCategory.value.trim(),
            description: newDescription.value.trim(),
        });
        newCategory.value = '';
        newDescription.value = '';
    }
}
</script>
<style scoped></style>
