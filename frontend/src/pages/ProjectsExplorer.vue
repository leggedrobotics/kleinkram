<template>
    <title-section title="Projects"></title-section>

    <div class="q-my-lg">
        <div class="flex justify-between items-center">
            <h2 class="text-h4 q-mb-xs">All Projects</h2>

            <button-group>
                <q-input
                    debounce="300"
                    label="Search"
                    dense
                    v-model="search"
                    outlined
                >
                    <template v-slot:append>
                        <q-icon name="sym_o_search" />
                    </template>
                </q-input>

                <q-btn
                    outline
                    dense
                    @click="() => refresh()"
                    pos
                    color="icon-secondary"
                    style="height: 36px"
                >
                    <q-icon name="sym_o_refresh" />
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>

                <create-project-button-opener>
                    <q-btn
                        flat
                        class="bg-button-secondary text-on-color"
                        label="Create Project"
                        icon="sym_o_add"
                    />
                </create-project-button-opener>
            </button-group>
        </div>

        <div style="padding-top: 10px">
            <Suspense>
                <template #fallback>
                    <div style="width: 550px; height: 67px">
                        <q-skeleton
                            class="q-mr-md q-mb-sm q-mt-sm"
                            style="width: 300px; height: 20px"
                        />
                        <q-skeleton
                            class="q-mr-md"
                            style="width: 200px; height: 18px"
                        />
                    </div>
                </template>
            </Suspense>
        </div>

        <div>
            <Suspense>
                <projects-table :url_handler="handler" v-if="handler" />
            </Suspense>
        </div>
    </div>
</template>
<script setup lang="ts">
import { useHandler } from 'src/hooks/customQueryHooks';
import { useQueryClient } from '@tanstack/vue-query';
import ProjectsTable from 'components/explorer_page/ExplorerPageProjectTable.vue';
import ButtonGroup from 'components/ButtonGroup.vue';
import CreateProjectButtonOpener from 'components/buttonWrapper/CreateProjectDialogOpener.vue';
import TitleSection from 'components/TitleSection.vue';
import { computed } from 'vue';

const queryClient = useQueryClient();
const handler = useHandler();

const search = computed({
    get: () => handler.value.search_params.name,
    set: (value: string) => {
        handler.value.setSearch({ name: value });
    },
});

function refresh() {
    queryClient.invalidateQueries({
        queryKey: ['projects'],
    });
}
</script>
