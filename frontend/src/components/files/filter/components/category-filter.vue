<template>
    <div class="column q-gutter-y-xs">
        <label class="text-weight-bold">File Categories</label>
        <q-select
            v-model="selectedCategories"
            outlined
            dense
            multiple
            use-chips
            :options="filteredCategories"
            option-label="name"
            option-value="uuid"
            use-input
            clearable
            bg-color="white"
            placeholder="Select Categories..."
            @filter="filterCategories"
        />
    </div>
</template>

<script setup lang="ts">
import { MissionFilterState } from 'src/composables/use-mission-file-filter';
import { MissionFileSearchContextData } from 'src/composables/use-mission-file-search';
import { computed, PropType, ref } from 'vue';

const props = defineProps({
    state: {
        type: Object as PropType<MissionFilterState>,
        required: true,
    },
    context: {
        type: Object as PropType<MissionFileSearchContextData>,
        required: true,
    },
});

interface CategoryOption {
    name: string;
    uuid: string;
}

const allCategories = computed(() => {
    return props.context.availableCategories;
});

const filteredCategories = ref<CategoryOption[]>(allCategories.value);

const selectedCategories = computed({
    get: () => {
        return props.state.categories
            .map((uuid) => allCategories.value.find((c) => c.uuid === uuid))
            .filter((c): c is CategoryOption => !!c);
    },
    set: (value: CategoryOption[] | null) => {
        // eslint-disable-next-line vue/no-mutating-props
        props.state.categories = value ? value.map((c) => c.uuid) : [];
    },
});

function filterCategories(
    value: string,
    update: (function_: () => void) => void,
) {
    if (value === '') {
        update(() => {
            filteredCategories.value = allCategories.value;
        });
        return;
    }
    update(() => {
        const needle = value.toLowerCase();
        filteredCategories.value = allCategories.value.filter((v) =>
            v.name.toLowerCase().includes(needle),
        );
    });
}

import { watch } from 'vue';
watch(allCategories, (newValue) => {
    filteredCategories.value = newValue;
});
</script>
