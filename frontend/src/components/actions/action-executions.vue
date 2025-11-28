<template>
    <div class="column q-gutter-y-md">
        <div class="flex justify-between items-center">
            <ScopeSelector
                layout="row"
                mode="filter"
                :show-labels="false"
                project-placeholder="All Projects"
                mission-placeholder="All Missions"
                style="min-width: 300px"
            />

            <div class="flex q-gutter-x-sm items-center">
                <app-search-bar
                    v-model="searchName"
                    placeholder="Filter executions..."
                />

                <app-refresh-button @click="refetchData" />
            </div>
        </div>

        <template v-if="hasScope">
            <ActionsTable :handler="handler" />
        </template>
        <div v-else class="flex flex-center q-pa-xl text-grey col-grow">
            <div class="column items-center text-center">
                <q-icon
                    name="sym_o_filter_alt"
                    size="4rem"
                    class="q-mb-md text-grey-4"
                />
                <span class="text-h6 text-grey-6">No Scope Selected</span>
                <span class="text-caption" style="max-width: 300px">
                    Please select a Project and Mission to view executions.
                </span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import ActionsTable from 'components/actions/actions-table.vue';
import AppSearchBar from 'components/common/app-search-bar.vue';
import AppRefreshButton from 'components/common/app-refresh-button.vue';
import { useHandler } from 'src/hooks/query-hooks';
import { computed } from 'vue';

import ScopeSelector from 'components/common/scope-selector.vue';

const handler = useHandler();
const queryClient = useQueryClient();

const hasScope = computed(
    () => !!handler.value.projectUuid && !!handler.value.missionUuid,
);

const searchName = computed({
    get: () => handler.value.searchParams.name,
    set: (value) => {
        handler.value.setSearch({ name: value ?? '' });
    },
});

const refetchData = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['action_mission'] });
};
</script>
