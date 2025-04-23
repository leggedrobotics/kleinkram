<template>
    <a
        class="flex items-center flex-no-wrap"
        style="color: grey; text-decoration: none"
        :href="link"
    >
        <q-icon name="sym_o_help" style="font-size: 20px" />
        <p class="q-mb-none" style="line-height: 24px; padding-left: 6px">
            {{ text }}
        </p>
    </a>
</template>
<script setup lang="ts">
const { link, text } = defineProps<{
    link: string;
    text?: string;
}>();
</script>
