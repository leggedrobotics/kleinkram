<template>
    <q-btn
        flat
        style="height: 100%"
        class="bg-button-secondary text-on-color"
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

const emit = defineEmits<{
    (e: 'click', event: Event): void;
}>();

const onClick = (event: Event): void => {
    emit('click', event);
};
</script>
