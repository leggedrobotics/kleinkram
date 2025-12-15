<template>
    <div class="column q-gutter-y-md">
        <div class="flex justify-between items-center">
            <div class="row q-gutter-x-md items-center">
                <ScopeSelector
                    layout="row"
                    mode="filter"
                    :show-labels="false"
                    project-placeholder="All Projects"
                    mission-placeholder="All Missions"
                    select-width="220px"
                    bg-color="transparent"
                />

                <AppSearchBar
                    v-model="searchName"
                    placeholder="Filter by Action Name"
                    style="min-width: 200px"
                />
            </div>

            <app-refresh-button @click="refetchData" />
        </div>

        <ActionsTable :handler="handler" />
    </div>
</template>

<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import ActionsTable from 'components/actions/actions-table.vue';
import AppRefreshButton from 'components/common/app-refresh-button.vue';
import AppSearchBar from 'components/common/app-search-bar.vue';
import { actionKeys } from 'src/api/keys/action-keys';
import { useHandler } from 'src/hooks/query-hooks';
import { computed } from 'vue';

import ScopeSelector from 'components/common/scope-selector.vue';

const handler = useHandler();
const queryClient = useQueryClient();

const searchName = computed({
    get: () => handler.value.searchParams.name ?? null,
    set: (value) => {
        handler.value.setSearch({ name: value ?? '' });
    },
});

const refetchData = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: actionKeys.all });
};
</script>
