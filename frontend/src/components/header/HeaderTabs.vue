<template>
    <q-tabs inline-label class="height-xxl">
        <q-route-tab
            v-show="$q.screen.lt.lg"
            no-caps
            class="q-py-none q-px-sm q-mx-sm text-secondary"
            key="menu"
            label="Menu"
            icon="sym_o_menu"
        >
            <q-menu auto-close style="width: 280px">
                <q-list>
                    <q-item
                        v-for="item in main_menu"
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
            v-show="$q.screen.gt.md"
            no-caps
            class="q-py-none q-px-sm q-mx-sm text-secondary"
            v-for="item in main_menu"
            :key="item.title"
            :label="item.title"
            :to="item.to"
            :icon="item.icon"
        />
    </q-tabs>
</template>

<script setup lang="ts">
interface MainMenu {
    title: string;
    to: string;
    icon: string;
}

const { main_menu } = defineProps<{
    main_menu: MainMenu[];
}>();
</script>
