<template>
    <q-card
        v-if="suggestions.length > 0"
        ref="containerReference"
        class="absolute-top-left full-width z-top shadow-4"
        style="top: 40px; max-height: 300px; overflow-y: auto"
        @mousedown.prevent
    >
        <q-list dense separator>
            <q-item
                v-for="(suggestion, index) in suggestions"
                :key="index"
                clickable
                :active="selectedIndex === index"
                active-class="bg-blue-1 text-primary"
                :disable="suggestion.disabled"
                @mousedown.prevent="() => $emit('select', suggestion)"
            >
                <q-item-section avatar>
                    <q-icon
                        :name="suggestion.icon"
                        size="xs"
                        :color="suggestion.disabled ? 'grey-6' : 'grey-7'"
                    />
                </q-item-section>
                <q-item-section>
                    <q-item-label
                        :class="{ 'text-grey-6': suggestion.disabled }"
                    >
                        <span class="text-grey-8">{{ suggestion.prefix }}</span
                        >{{ suggestion.label }}
                    </q-item-label>
                    <q-item-label
                        caption
                        :class="suggestion.disabled ? 'text-grey-6' : ''"
                        >{{ suggestion.description }}</q-item-label
                    >
                </q-item-section>
            </q-item>
        </q-list>
    </q-card>
</template>

<script setup lang="ts">
import { Suggestion } from 'src/services/suggestions/suggestion-types';
import { nextTick, ref, watch } from 'vue';

const props = defineProps<{
    suggestions: Suggestion[];
    selectedIndex: number;
}>();

defineEmits<(event: 'select', suggestion: Suggestion) => void>();

const containerReference = ref<HTMLElement | null>(null);

watch(
    () => props.selectedIndex,
    async (newIndex) => {
        await nextTick();
        if (!containerReference.value) return;

        // Find the active item safely
        const list = containerReference.value.querySelector('.q-list');
        if (!list) return;

        // Use querySelectorAll to ensure we only get items, ignoring potential separators
        const items = list.querySelectorAll('.q-item');
        const activeItem = items[newIndex] as HTMLElement;

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (activeItem) {
            const container = containerReference.value;
            const itemRect = activeItem.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Scroll down if below view
            if (itemRect.bottom > containerRect.bottom) {
                container.scrollTop += itemRect.bottom - containerRect.bottom;
            }
            // Scroll up if above view
            else if (itemRect.top < containerRect.top) {
                container.scrollTop -= containerRect.top - itemRect.top;
            }
        }
    },
);
</script>
