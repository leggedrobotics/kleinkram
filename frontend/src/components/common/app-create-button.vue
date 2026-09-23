<template>
    <q-btn
        flat
        class="bg-button-secondary text-on-color app-create-button"
        :icon="icon"
        :label="label"
        :disable="disable"
        @click="onClick"
    >
        <slot />
    </q-btn>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        label: string;
        icon?: string;
        disable?: boolean;
    }>(),
    {
        icon: 'sym_o_add',
        disable: false,
    },
);

const emit = defineEmits<(event: 'click', event_: Event) => void>();

const onClick = (event: Event): void => {
    emit('click', event);
};
</script>

<style scoped>
.app-create-button {
    height: 100%;
}

/* Touch target on small screens */
@media (max-width: 1023px) {
    .app-create-button {
        min-height: 40px;
    }
}
</style>
