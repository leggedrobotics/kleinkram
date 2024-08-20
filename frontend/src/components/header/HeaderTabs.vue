<template>
    <q-tabs inline-label class="height-xxl">
        <q-route-tab
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
