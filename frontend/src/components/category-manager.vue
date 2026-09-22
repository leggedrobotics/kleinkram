<template>
    <div>
        <q-input
            v-model="filter"
            outlined
            dense
            clearable
            debounce="300"
            placeholder="Search categories"
        >
            <template #prepend>
                <q-icon name="sym_o_search" />
            </template>
        </q-input>

        <div v-if="categories.length === 0" class="q-pa-md text-grey">
            No categories in this project yet.
        </div>

        <q-list v-else separator style="max-height: 300px; overflow-y: auto">
            <q-item v-for="category in categories" :key="category.uuid">
                <q-item-section>
                    <div>
                        <q-chip
                            dense
                            :color="hashUUIDtoColor(category.uuid)"
                            style="color: white"
                        >
                            {{ category.name }}
                        </q-chip>
                    </div>
                    <q-input
                        :model-value="descriptionOf(category)"
                        outlined
                        dense
                        type="textarea"
                        autogrow
                        input-style="min-height: 40px"
                        :readonly="!canEdit"
                        :placeholder="
                            canEdit
                                ? 'Description (optional)'
                                : 'No description'
                        "
                        @update:model-value="
                            (value) =>
                                setDescription(category, String(value ?? ''))
                        "
                    />
                </q-item-section>
                <q-item-section v-if="canEdit" side top>
                    <q-btn
                        flat
                        dense
                        icon="sym_o_save"
                        :disable="!isModified(category)"
                        :loading="savingUuid === category.uuid"
                        @click="() => save(category)"
                    >
                        <q-tooltip>Save description</q-tooltip>
                    </q-btn>
                </q-item-section>
            </q-item>
        </q-list>

        <div v-if="!canEdit" class="q-pa-sm text-caption text-grey">
            Editing category descriptions requires write access on the project.
        </div>
    </div>
</template>
<script setup lang="ts">
import type { CategoryDto } from '@kleinkram/api-dto/types/category.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import {
    canModifyProject,
    useCategories,
    usePermissionsQuery,
} from 'src/hooks/query-hooks';
import { hashUUIDtoColor } from 'src/services/generic';
import { updateCategoryDescription } from 'src/services/mutations/categories';
import { computed, ref, Ref } from 'vue';

const { projectUuid } = defineProps<{
    projectUuid: string;
}>();

const queryClient = useQueryClient();

const filter = ref('');
const savingUuid = ref<string | undefined>();

/**
 * Descriptions the user edited but did not save yet, keyed by category uuid.
 */
const edited = ref<Record<string, string>>({});

const { data: _categories } = useCategories(projectUuid, filter);
const { data: permissions } = usePermissionsQuery();

/**
 * Updating a description requires write access on the project, which a user
 * with mission-only write access does not have.
 */
const canEdit = computed(() =>
    canModifyProject(projectUuid, permissions.value),
);

const categories: Ref<CategoryDto[]> = computed(
    () => _categories.value?.data ?? [],
);

const descriptionOf = (category: CategoryDto): string =>
    edited.value[category.uuid] ?? category.description;

const isModified = (category: CategoryDto): boolean =>
    descriptionOf(category) !== category.description;

const setDescription = (category: CategoryDto, value: string): void => {
    edited.value[category.uuid] = value;
};

interface DescriptionUpdate {
    uuid: string;
    description: string;
}

const { mutate } = useMutation({
    mutationFn: ({ uuid, description }: DescriptionUpdate) =>
        updateCategoryDescription(uuid, projectUuid, description),
    onSuccess: async (_, { uuid, description }: DescriptionUpdate) => {
        // drafts typed while the request was in flight are newer than the
        // value the server just stored, so only drop the submitted one
        if (edited.value[uuid]?.trim() === description) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete edited.value[uuid];
        }
        await queryClient.invalidateQueries({
            predicate: (query) =>
                ['categories', 'file', 'files'].includes(
                    query.queryKey[0] as string,
                ),
        });
        Notify.create({
            message: 'Description updated',
            color: 'positive',
            position: 'bottom',
        });
    },
    onError: (error: Error) =>
        Notify.create({
            message: error.message,
            color: 'negative',
            position: 'bottom',
        }),
    onSettled: (_data, _error, { uuid }: DescriptionUpdate) => {
        if (savingUuid.value === uuid) savingUuid.value = undefined;
    },
});

const save = (category: CategoryDto): void => {
    savingUuid.value = category.uuid;
    mutate({
        uuid: category.uuid,
        description: descriptionOf(category).trim(),
    });
};
</script>
<style scoped></style>
