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
                <q-input
                    v-model="searchName"
                    dense
                    outlined
                    placeholder="Filter executions..."
                    bg-color="white"
                >
                    <template #append><q-icon name="sym_o_search" /></template>
                </q-input>

                <q-btn
                    flat
                    dense
                    round
                    color="primary"
                    icon="sym_o_refresh"
                    @click="refetchData"
                >
                    <q-tooltip>Refresh</q-tooltip>
                </q-btn>
            </div>
        </div>

        <template v-if="hasScope">
            <ActionsTable :handler="handler" />
        </template>
    </div>
</template>

<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import ActionsTable from 'components/actions/actions-table.vue';
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
