<template>
    <div class="flex justify-between items-center">
        <button-group>
            <my-projects-selector v-model="myProjects" />
        </button-group>

        <button-group>
            <q-input
                v-model="search"
                debounce="300"
                placeholder="Search by Project Name"
                dense
                outlined
            >
                <template #append>
                    <q-icon name="sym_o_search" />
                </template>
            </q-input>

            <q-btn
                flat
                dense
                padding="6px"
                color="icon-secondary"
                class="button-border"
                icon="sym_o_loop"
                @click="resetCache"
            >
                <q-tooltip> Refetch the Data</q-tooltip>
            </q-btn>

            <dialog-opener-create-project>
                <q-btn
                    flat
                    style="height: 100%"
                    class="bg-button-secondary text-on-color"
                    label="Create Project"
                    icon="sym_o_add"
                />
            </dialog-opener-create-project>
        </button-group>
    </div>
</template>

<script setup lang="ts">
import { useHandler } from '../../hooks/query-hooks';
import { useQueryClient } from '@tanstack/vue-query';
import { ref, watch } from 'vue';
import DialogOpenerCreateProject from '@components/button-wrapper/dialog-opener-create-project.vue';
import ButtonGroup from '@components/buttons/button-group.vue';
import MyProjectsSelector from '@components/explorer-page/my-projects-selector.vue';

const myProjects = defineModel<boolean>();
const queryClient = useQueryClient();
const handler = useHandler();

const search = ref(handler.value.searchParams.name);

async function resetCache(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
}

watch([myProjects, search], () => {
    handler.value.setSearch({ name: search.value });
    // TODO: fix that we need a timeout here!!!
    setTimeout(() => {
        resetCache().catch(() => ({}));
    });
});
</script>
