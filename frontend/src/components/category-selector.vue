<template>
    <div v-if="selected">
        <label :for="inputId">Categories</label>
        <q-select
            ref="selectReference"
            v-model="selected"
            no-error-icon
            :for="inputId"
            multiple
            color="button-primary"
            options-selected-class="multi-option--selected"
            option-label="name"
            option-value="uuid"
            :options="options"
            dense
            outlined
            hide-bottom-space
            use-input
            input-debounce="300"
            :loading="isCreating"
            :placeholder="selected.length > 0 ? '' : 'Search or create'"
            class="category-selector"
            @input-value="onInputChange"
        >
            <template #selected-item="props">
                <span
                    v-if="props.opt"
                    class="category-chip"
                    :style="categoryTagStyle(props.opt.uuid)"
                >
                    {{ props.opt.name }}
                    <q-tooltip v-if="props.opt.description">
                        {{ props.opt.description }}
                    </q-tooltip>
                    <button
                        type="button"
                        class="category-chip__remove"
                        :aria-label="`Remove ${props.opt.name}`"
                        @click.stop="() => props.removeAtIndex(props.index)"
                    >
                        <q-icon name="sym_o_close" size="16px" />
                    </button>
                </span>
            </template>
            <template #no-option>
                <div class="category-selector__empty">
                    {{ emptyMessage }}
                </div>
            </template>
            <template #option="props">
                <q-item
                    v-bind="props.itemProps"
                    dense
                    :class="{
                        'category-option--create': props.opt.uuid === CREATE,
                    }"
                >
                    <q-item-section v-if="props.opt.uuid === CREATE">
                        <q-item-label class="category-option__create-label">
                            + Create "{{ props.opt.name }}"
                        </q-item-label>
                    </q-item-section>
                    <template v-else>
                        <q-item-section side class="multi-option__check">
                            <q-checkbox
                                :model-value="props.selected"
                                dense
                                size="sm"
                                color="button-primary"
                                tabindex="-1"
                                aria-hidden="true"
                                class="no-pointer-events"
                            />
                        </q-item-section>
                        <q-item-section class="multi-option__label">
                            <q-item-label>{{ props.opt.name }}</q-item-label>
                        </q-item-section>
                        <q-item-section v-if="props.opt.description" side>
                            <q-item-label class="category-option__description">
                                {{ props.opt.description }}
                            </q-item-label>
                        </q-item-section>
                    </template>
                </q-item>
            </template>
        </q-select>
    </div>
</template>
<script setup lang="ts">
import type { CategoryDto } from '@kleinkram/api-dto/types/category.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, QSelect } from 'quasar';
import {
    canCreateMission,
    useCategories,
    usePermissionsQuery,
} from 'src/hooks/query-hooks';
import { getErrorMessage } from 'src/services/error-handling';
import { categoryTagStyle } from 'src/services/generic';
import { createCategory } from 'src/services/mutations/categories';
import { computed, ref, useId } from 'vue';

/** uuid of the "+ Create …" option */
const CREATE = '__create__';
/** the shortest name the create form accepted */
const MIN_NAME_LENGTH = 2;

const properties = defineProps<{
    selected: CategoryDto[];
    projectUuid: string;
}>();

const emit = defineEmits(['update:selected']);

const inputId = `category-selector-${useId()}`;
const selectReference = ref<QSelect | undefined>();
const queryClient = useQueryClient();

const filter = ref('');
const inputText = ref('');

const { data: _categories } = useCategories(properties.projectUuid, filter);
const { data: permissions } = usePermissionsQuery();

/** creating a category needs CREATE on the project, like a mission */
const canCreate = computed(() =>
    canCreateMission(properties.projectUuid, permissions.value),
);

const categories = computed<CategoryDto[]>(() => {
    const query = inputText.value.trim().toLowerCase();
    return (_categories.value?.data ?? []).filter((category) =>
        category.name.toLowerCase().includes(query),
    );
});

const options = computed<CategoryDto[]>(() => {
    const name = inputText.value.trim();
    const exists = (_categories.value?.data ?? []).some(
        (category) => category.name.toLowerCase() === name.toLowerCase(),
    );
    if (!canCreate.value || name.length < MIN_NAME_LENGTH || exists) {
        return categories.value;
    }
    return [...categories.value, { uuid: CREATE, name, description: '' }];
});

/** shown when the list has nothing to offer, so a click never looks dead */
const emptyMessage = computed(() => {
    const hasCategories = (_categories.value?.data.length ?? 0) > 0;
    if (inputText.value.trim() !== '' && hasCategories)
        return 'No matching categories.';
    if (!canCreate.value) return 'No categories in this project.';
    return hasCategories
        ? 'Type at least 2 characters to create a category.'
        : 'No categories yet. Type a name to create one.';
});

const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: (name: string) =>
        createCategory(name, properties.projectUuid) as Promise<CategoryDto>,
    onSuccess: async (category: CategoryDto) => {
        emit('update:selected', [...properties.selected, category]);
        await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'categories',
        });
    },
    onError: (error: Error) =>
        Notify.create({
            message: getErrorMessage(error),
            color: 'negative',
            position: 'bottom',
        }),
});

const selected = computed({
    get: () => properties.selected,
    set: (value: CategoryDto[]) => {
        const createOption = value.find((category) => category.uuid === CREATE);
        if (createOption) {
            create(createOption.name);
            selectReference.value?.updateInputValue('', true);
            inputText.value = '';
            filter.value = '';
            return;
        }
        emit('update:selected', value);
    },
});

const onInputChange = (value: string): void => {
    inputText.value = value;
    filter.value = value;
};
</script>

<style scoped>
.category-selector__empty {
    padding: 8px 12px;
    color: #525252; /* $text-secondary */
    font-size: 13px;
}

.multi-option__check {
    padding-right: 8px;
}

/* the selection shows in the checkbox, the label keeps its colour */
.multi-option__label {
    color: #161616;
}

.category-selector :deep(.q-field__native) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding: 4px 0;
}

.category-selector :deep(.q-field__input) {
    min-height: 24px;
    line-height: 24px;
}

.category-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 24px;
    padding: 0 4px 0 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    line-height: 24px;
    white-space: nowrap;
}

.category-chip__remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    cursor: pointer;
}

.category-chip__remove:hover {
    background: rgb(0 0 0 / 8%);
}

.category-chip__remove:focus-visible {
    outline: 2px solid #0f62fe;
    outline-offset: 1px;
}

/* $text-helper */
.category-option__description {
    color: #6f6f6f;
    font-size: 12px;
}

/* $link-primary, separated from the existing categories */
.category-option--create {
    border-top: 1px solid #e0e0e0;
}

.category-option__create-label {
    color: #0f62fe;
}
</style>
