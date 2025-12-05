<template>
    <div class="playback-controls row items-center q-gutter-sm">
        <q-btn
            round
            flat
            dense
            icon="sym_o_skip_previous"
            @click="onPrevious"
        />

        <q-btn
            round
            color="primary"
            :icon="isPlaying ? 'sym_o_pause' : 'sym_o_play_arrow'"
            @click="onToggle"
        >
            <q-tooltip>{{ isPlaying ? 'Pause' : 'Play' }}</q-tooltip>
        </q-btn>

        <q-btn round flat dense icon="sym_o_skip_next" @click="onNext" />

        <div class="col q-px-sm">
            <q-slider
                :model-value="modelValue"
                :min="0"
                :max="max"
                label
                color="primary"
                @update:model-value="onUpdateModelValue"
            />
        </div>

        <div
            class="text-caption text-grey-7"
            style="min-width: 80px; text-align: right"
        >
            {{ modelValue + 1 }} / {{ max + 1 }}
        </div>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    modelValue: number;
    max: number;
    isPlaying: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'toggle', 'next', 'prev']);

const onPrevious = (): void => {
    emit('prev');
};

const onToggle = (): void => {
    emit('toggle');
};

const onNext = (): void => {
    emit('next');
};

// Quasar sliders can emit null, so we type 'value' loosely or as number | null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onUpdateModelValue = (value: any): void => {
    emit('update:modelValue', value);
};
</script>
