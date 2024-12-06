<template>
    <a
        class="flex items-center flex-no-wrap"
        style="color: grey; text-decoration: none"
        :href="props.link"
    >
        <q-icon name="sym_o_help" style="font-size: 20px" />
        <p class="q-mb-none" style="line-height: 24px; padding-left: 6px">
            {{ props.text }}
        </p>
    </a>
</template>
<script setup lang="ts">
const props = defineProps<{
    link?: string;
    text?: string;
}>();
</script>
