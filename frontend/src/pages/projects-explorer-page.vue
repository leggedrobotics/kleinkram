<template>
    <title-section title="Projects" />

    <div class="q-my-lg">
        <div class="flex justify-between items-center">
            <button-group>
                <q-btn-dropdown dense flat class="button-border q-px-sm">
                    <template #label>
                        {{ myProjects ? 'My Projects' : 'All Projects' }}
                    </template>
                    <q-list>
                        <q-item
                            v-for="(item, index) in [
                                'All Projects',
                                'My Projects',
                            ]"
                            :key="index"
                            v-close-popup
                            clickable
                            @click="() => (myProjects = item === 'My Projects')"
                        >
                            <q-item-section>
                                {{ item }}
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>
            </button-group>

            <button-group>
                <q-input
                    v-model="search"
                    debounce="300"
                    placeholder="Search"
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
                    @click="refresh"
                >
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>

                <create-project-dialog-opener>
                    <q-btn
                        flat
                        style="height: 100%"
                        class="bg-button-secondary text-on-color"
                        label="Create Project"
                        icon="sym_o_add"
                    />
                </create-project-dialog-opener>
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
                <explorer-page-project-table :my-projects="myProjects" />
            </Suspense>
        </div>
    </div>
</template>
<script setup lang="ts">
import { useHandler } from '../hooks/query-hooks';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import ExplorerPageProjectTable from '@components/explorer-page/explorer-page-project-table.vue';
import CreateProjectDialogOpener from '@components/button-wrapper/dialog-opener-create-project.vue';
import ButtonGroup from '@components/buttons/button-group.vue';
import TitleSection from '@components/title-section.vue';

const myProjects = ref(false);

const queryClient = useQueryClient();
const handler = useHandler();

const search = computed({
    get: () => handler.value.searchParams.name,
    set: (value: string) => {
        handler.value.setSearch({ name: value });
    },
});

async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({
        queryKey: ['projects'],
    });
}

watch(myProjects, async () => refresh());
</script>
