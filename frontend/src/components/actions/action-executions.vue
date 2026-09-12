<template>
    <div class="column q-gutter-y-md">
        <!--
            Below `md` the filters do not fit next to each other, so they stack
            into a single full width column.
        -->
        <div
            :class="
                $q.screen.lt.md
                    ? 'column q-gutter-y-sm'
                    : 'flex justify-between items-center'
            "
        >
            <div
                :class="
                    $q.screen.lt.md
                        ? 'column q-gutter-y-sm'
                        : 'row q-gutter-x-md items-center'
                "
            >
                <ScopeSelector
                    :layout="$q.screen.lt.md ? 'column' : 'row'"
                    mode="filter"
                    :show-labels="false"
                    project-placeholder="All Projects"
                    mission-placeholder="All Missions"
                    :select-width="$q.screen.lt.md ? undefined : '220px'"
                    bg-color="transparent"
                />

                <AppSearchBar
                    v-model="searchName"
                    placeholder="Filter by Action Name"
                    :style="$q.screen.lt.md ? undefined : 'min-width: 200px'"
                />
            </div>

            <app-refresh-button
                :class="$q.screen.lt.md ? 'self-end' : ''"
                @click="refetchData"
            />
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
