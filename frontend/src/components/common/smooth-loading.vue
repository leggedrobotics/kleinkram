<template>
    <div
        class="smooth-loading flex flex-center column q-pa-md"
        :class="$attrs.class"
    >
        <q-spinner-dots color="primary" size="3em" />
        <div class="q-mt-sm">
            {{ messageText }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';

const props = defineProps<{
    current: number;
    total: number;
    message?: string;
}>();

const displayedCurrent = ref(props.current);
let animationFrame: number | null = null;

const animate = () => {
    if (Math.abs(displayedCurrent.value - props.current) < 0.5) {
        displayedCurrent.value = props.current;
        animationFrame = null;
        return;
    }

    // Simple lerp for smoothing
    displayedCurrent.value += (props.current - displayedCurrent.value) * 0.1;
    animationFrame = requestAnimationFrame(animate);
};

watch(
    () => props.current,
    () => {
        if (!animationFrame) {
            animationFrame = requestAnimationFrame(animate);
        }
    },
);

onUnmounted(() => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
});

const messageText = computed(() => {
    const count = Math.round(displayedCurrent.value);
    if (props.message) {
        return props.message
            .replace('{current}', count.toString())
            .replace('{total}', props.total.toString());
    }
    return `Loaded ${count} / ${props.total} messages`;
});
</script>
