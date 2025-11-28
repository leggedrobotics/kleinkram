<template>
    <div class="flex justify-between items-center">
        <button-group>
            <my-projects-selector
                v-if="myProjects !== undefined"
                v-model="myProjects"
                class="self-stretch"
            />
        </button-group>

        <button-group>
            <app-search-bar
                v-model="search"
                placeholder="Search by Project Name"
            />

            <app-refresh-button @click="resetCache" />

            <dialog-opener-create-project>
                <app-create-button label="Create Project" />
            </dialog-opener-create-project>
        </button-group>
    </div>
</template>

<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import DialogOpenerCreateProject from 'components/button-wrapper/dialog-opener-create-project.vue';
import AppSearchBar from 'components/common/app-search-bar.vue';
import AppRefreshButton from 'components/common/app-refresh-button.vue';
import AppCreateButton from 'components/common/app-create-button.vue';
import ButtonGroup from 'components/buttons/button-group.vue';
import MyProjectsSelector from 'components/explorer-page/my-projects-selector.vue';
import { useHandler } from 'src/hooks/query-hooks';
import { ref, watch } from 'vue';

const myProjects = defineModel<boolean>();
const queryClient = useQueryClient();
const handler = useHandler();

const search = ref(handler.value.searchParams.name);

async function resetCache(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
}

watch([myProjects, search], () => {
    handler.value.setSearch({ name: search.value ?? '' });
    // TODO: fix that we need a timeout here!!!
    setTimeout(() => {
        resetCache().catch(() => ({}));
    });
});
</script>
