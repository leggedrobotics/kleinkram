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
                :readonly="isPending"
                :error="!!nameError"
                :error-message="nameError"
                @update:model-value="clearNameError"
                @keyup.enter="addCategory"
            />
            <q-btn
                class="bg-button-primary q-my-md"
                flat
                label="Add"
                icon="sym_o_add"
                style="width: 20%"
                :disable="!newCategory || newCategory.length < 2"
                :loading="isPending"
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
            :readonly="isPending"
            hint="Explain what files belong into this category"
        />
    </div>
</template>
<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, QNotifyCreateOptions } from 'quasar';
import { getErrorMessage, getErrorStatus } from 'src/services/error-handling';
import { createCategory } from 'src/services/mutations/categories';
import { ref } from 'vue';

const properties = defineProps<{
    projectUuid: string;
}>();
const queryClient = useQueryClient();

const newCategory = ref('');
const newDescription = ref('');
// a taken name is shown on the name input, it's the field the user has to fix.
// Both inputs are read-only while the request runs, so the response always
// belongs to what is shown: clearing on success can't drop newer edits, and a
// conflict can't land on a name typed afterwards.
const nameError = ref('');
const clearNameError = (): void => {
    nameError.value = '';
};
const { mutate, isPending } = useMutation({
    mutationFn: ({
        name,
        description,
    }: {
        name: string;
        description: string;
    }) => createCategory(name, properties.projectUuid, description),
    onSuccess: async () => {
        // inputs are only cleared once the category exists, a failed request
        // keeps them so the user can fix the name and retry
        newCategory.value = '';
        newDescription.value = '';
        await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'categories',
        });
        Notify.create({
            message: 'Category added',
            color: 'positive',
            location: 'bottom',
        } as QNotifyCreateOptions);
    },
    onError: (error: Error) => {
        if (getErrorStatus(error) === 409) {
            nameError.value = getErrorMessage(error);
            return;
        }
        Notify.create({
            message: `Failed to add category: ${getErrorMessage(error)}`,
            color: 'negative',
            position: 'bottom',
        });
    },
});

function addCategory() {
    if (isPending.value) return;
    if (newCategory.value && newCategory.value.length >= 2) {
        nameError.value = '';
        mutate({
            name: newCategory.value.trim(),
            description: newDescription.value.trim(),
        });
    }
}
</script>
<style scoped></style>
