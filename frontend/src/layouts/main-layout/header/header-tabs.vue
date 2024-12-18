<template>
    <q-tabs inline-label class="height-xxl">
        <q-route-tab
            v-show="$q.screen.lt.lg"
            key="menu"
            no-caps
            class="q-py-none q-px-sm q-mx-sm text-secondary"
            label="Menu"
            icon="sym_o_menu"
        >
            <q-menu auto-close style="width: 280px">
                <q-list>
                    <q-item
                        v-for="item in mainMenu"
                        :key="item.title"
                        clickable
                        :to="item.to"
                    >
                        <q-item-section avatar>
                            <q-icon
                                :name="item.icon"
                                style="font-weight: bold"
                            />
                        </q-item-section>
                        <q-item-section>
                            <q-item-label>{{ item.title }}</q-item-label>
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-menu>
        </q-route-tab>

        <q-route-tab
            v-for="item in mainMenu"
            v-show="$q.screen.gt.md"
            :key="item.title"
            no-caps
            class="q-py-none q-px-sm q-mx-sm text-secondary"
            :class="{ 'q-tab--active': path === item.to }"
            :label="item.title"
            :to="item.to"
            :icon="item.icon"
        />
    </q-tabs>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed } from 'vue';

export interface MainMenu {
    title: string;
    to: string;
    icon: string;
    subpageNames: string[];
}

const { mainMenu } = defineProps<{ mainMenu: MainMenu[] }>();

const route = useRoute();
const path = computed(() => {
    const nameWithPostfix = `${route.name as string}Layout`;
    const menuItem = mainMenu.find((item) =>
        item.subpageNames.includes(nameWithPostfix),
    );
    return menuItem?.to ?? route.path;
});
</script>
