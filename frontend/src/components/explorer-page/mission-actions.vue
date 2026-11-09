<template>
    <div class="column q-gutter-y-md">
        <div
            class="flex items-center actions-toolbar"
            :class="isMobile ? 'no-wrap' : 'justify-between'"
        >
            <div class="actions-toolbar__search q-ml-xs">
                <AppSearchBar
                    v-model="searchName"
                    placeholder="Filter by Action Name"
                />
            </div>

            <app-refresh-button
                aria-label="Refresh action executions"
                @click="refetchData"
            />
        </div>

        <!--
            actions-table.vue drops its secondary columns below md and switches
            to cards on phones; the wrapper only makes sure a leftover overflow
            scrolls inside the tab instead of the page.
        -->
        <div class="actions-table-scroll">
            <ActionsTable :handler="handler" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import ActionsTable from 'components/actions/actions-table.vue';
import AppRefreshButton from 'components/common/app-refresh-button.vue';
import AppSearchBar from 'components/common/app-search-bar.vue';
import { useQuasar } from 'quasar';
import { actionKeys } from 'src/api/keys/action-keys';
import { useHandler } from 'src/hooks/query-hooks';
import { computed } from 'vue';

const handler = useHandler();
const queryClient = useQueryClient();
const $q = useQuasar();

/**
 * Below 1024px the search field grows to the full width and only the refresh
 * button stays next to it.
 */
const isMobile = computed(() => $q.screen.lt.md);

const searchName = computed({
    get: () => handler.value.searchParams.name ?? '',
    set: (value) => {
        handler.value.setSearch({ name: value });
    },
});

const refetchData = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: actionKeys.all });
};
</script>

<style scoped>
.actions-toolbar {
    gap: 8px;
}

.actions-toolbar__search {
    min-width: 300px;
}

.actions-table-scroll {
    max-width: 100%;
}

@media (max-width: 1023px) {
    .actions-toolbar__search {
        flex: 1 1 auto;
        min-width: 0;
    }

    .actions-table-scroll {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }
}

@media (max-width: 599px) {
    .actions-table-scroll :deep(.q-table__bottom) {
        font-size: 12px;
        column-gap: 8px;
    }
}
</style>
