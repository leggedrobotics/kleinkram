<template>
    <div
        class="skeleton-time-chart rounded-borders overflow-hidden relative-position"
        :style="{ height: height + 'px' }"
    >
        <div class="absolute-full flex flex-center text-grey-3 pulsing">
            <svg
                width="100%"
                height="100%"
                viewBox="0 0 400 100"
                preserveAspectRatio="none"
            >
                <path
                    d="M0 50 Q 50 20, 100 50 T 200 50 T 300 50 T 400 50"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                />
            </svg>
        </div>

        <div class="absolute-center">
            <SmoothLoading
                v-if="(total ?? 0) > 0"
                :current="current ?? 0"
                :total="total ?? 0"
                message="Loading {current} / {total}..."
                class="text-h6 text-grey-8 text-weight-medium"
            />
            <div v-else class="text-h6 text-grey-8 text-weight-medium">
                Loading...
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import SmoothLoading from '../../common/smooth-loading.vue';

withDefaults(
    defineProps<{
        height?: number;
        current?: number;
        total?: number;
    }>(),
    {
        height: 200,
        current: 0,
        total: 0,
    },
);
</script>

<style scoped>
.skeleton-time-chart {
    border: 1px solid #eee;
    background: #fafafa;
}

.pulsing {
    animation: pulse-opacity 1.5s infinite ease-in-out;
}

@keyframes pulse-opacity {
    0% {
        opacity: 0.6;
    }
    50% {
        opacity: 0.3;
    }
    100% {
        opacity: 0.6;
    }
}
</style>
