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
                <projects-table v-if="handler" :url_handler="handler" />
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

const myProjects = ref(false);

const queryClient = useQueryClient();
const handler = useHandler();

watch(myProjects, async () => {
    const user = await getUser();

    if (myProjects.value) {
        handler.value.setSearch({
            ...handler.value.searchParams,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'creator.uuid': user.uuid,
        });
    } else {
        handler.value.setSearch({
            ...handler.value.searchParams,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'creator.uuid': '',
        });
    }
});

const search = computed({
    get: () => handler.value.searchParams.name,
    set: (value: string) => {
        handler.value.setSearch({ name: value });
    },
});

async function refresh() {
    await queryClient.invalidateQueries({
        queryKey: ['projects'],
    });
}
</script>
