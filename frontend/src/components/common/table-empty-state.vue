<template>
    <div class="full-width flex flex-center q-pa-xl text-grey">
        <div v-if="isEmpty" class="column items-center">
            <q-icon name="sym_o_folder_open" size="3rem" />
            <span class="q-mt-sm text-subtitle1">
                {{ emptyLabel }}
            </span>
            <div class="q-mt-md">
                <slot name="create-action" />
            </div>
        </div>

        <div v-else-if="hasFilter" class="column items-center">
            <q-icon name="sym_o_search_off" size="3rem" />
            <span class="q-mt-sm text-subtitle1">
                No files found matching your filters
            </span>
            <q-btn
                flat
                dense
                no-caps
                padding="6px"
                label="Reset Filters"
                class="button-border text-black q-mt-md"
                icon="sym_o_clear"
                @click="onReset"
            />
        </div>

        <div v-else class="column items-center">
            <span class="text-subtitle1">No data available</span>
        </div>
    </div>
</template>

<script setup lang="ts">
defineProps({
    isEmpty: {
        type: Boolean,
        default: false,
    },
    hasFilter: {
        type: Boolean,
        default: false,
    },
    emptyLabel: {
        type: String,
        default: 'No files uploaded yet',
    },
});

const emit = defineEmits(['reset']);

function onReset() {
    emit('reset');
}
</script>

<style scoped>
.button-border {
    border: 1px solid #e0e0e0;
    border-radius: 4px;
}
.button-border:hover {
    border-color: #8d8d8d;
}
</style>
