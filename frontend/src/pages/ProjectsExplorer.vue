<template>
    <title-section title="Projects"></title-section>

    <div class="q-my-lg">
        <div class="flex justify-between items-center">
            <h2 class="text-h4 q-mb-xs">All Projects</h2>

            <button-group>
                <q-btn-dropdown dense flat class="button-border q-px-sm">
                    <template v-slot:label>
                        {{ my_projects ? 'My Projects' : 'All Projects' }}
                    </template>
                    <q-list>
                        <q-item
                            v-for="(item, index) in [
                                'All Projects',
                                'My Projects',
                            ]"
                            clickable
                            :key="index"
                            v-close-popup
                            @click="my_projects = item === 'My Projects'"
                        >
                            <q-item-section>
                                {{ item }}
                            </q-item-section>
                        </q-item>
                    </q-list>
                </q-btn-dropdown>

                <q-input
                    debounce="300"
                    placeholder="Search"
                    dense
                    v-model="search"
                    outlined
                >
                    <template v-slot:append>
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
                    @click="() => refresh()"
                >
                    <q-tooltip> Refetch the Data</q-tooltip>
                </q-btn>

                <create-project-button-opener>
                    <q-btn
                        flat
                        style="height: 100%"
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
import { computed, ref, watch } from 'vue';
import { getUser } from 'src/services/auth';

const my_projects = ref(false);

const queryClient = useQueryClient();
const handler = useHandler();

watch(my_projects, async () => {
    const user = await getUser();

    if (my_projects.value) {
        handler.value.setSearch({
            ...handler.value.search_params,
            'creator.uuid': user.uuid,
        });
    } else {
        handler.value.setSearch({
            ...handler.value.search_params,
            'creator.uuid': undefined,
        });
    }
});

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
