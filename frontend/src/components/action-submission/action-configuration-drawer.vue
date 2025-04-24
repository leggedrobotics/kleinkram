<template>
    <q-drawer
        v-model="isDrawerOpen"
        side="right"
        :width="1000"
        style="bottom: 0 !important"
        bordered
        behavior="desktop"
    >
        <div class="q-pa-lg flex row justify-between header-style">
            <h3 class="text-h4 q-ma-none">Submit Action</h3>
            <q-btn
                flat
                dense
                padding="6px"
                class="button-border"
                icon="sym_o_close"
                @click="closeDrawer"
            />
        </div>

        <q-separator />

        <ActionConfigurationSettings
            v-if="isDrawerOpen"
            :mission-uuids="properties.missionUuids"
        />
    </q-drawer>
</template>

<script setup lang="ts">
import ActionConfigurationSettings from 'components/action-submission/action-configuration-settings.vue';
import { ref, watch } from 'vue';

const isDrawerOpen = ref(false);
const emits = defineEmits(['close']);

const properties = defineProps<{
    missionUuids: string[] | undefined;
    open?: boolean;
}>();

const closeDrawer = (): void => {
    isDrawerOpen.value = false;
    emits('close');
};

watch(
    () => properties.open,
    (newValue) => {
        if (newValue !== undefined) isDrawerOpen.value = newValue;
    },
    { immediate: true },
);
</script>

<style scoped>
.header-style {
    height: 84px;
}
</style>
