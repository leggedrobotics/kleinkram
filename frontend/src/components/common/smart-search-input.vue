<template>
    <div class="smart-filter-input relative-position">
        <q-field
            ref="fieldReference"
            outlined
            dense
            bg-color="white"
            class="full-width cursor-text"
            @focus="focusInput"
        >
            <template #control>
                <div
                    class="input-container relative-position full-width"
                    style="height: 24px; overflow: hidden"
                >
                    <!-- Mirror Div (for highlighting) -->
                    <!-- eslint-disable vue/no-v-html -->
                    <div
                        ref="mirrorReference"
                        class="input-mirror no-pointer-events"
                        aria-hidden="true"
                        v-html="highlightedHtml"
                    ></div>
                    <!-- eslint-enable vue/no-v-html -->

                    <!-- Actual Input (transparent text, visible caret, no background) -->
                    <input
                        ref="inputReference"
                        v-model="internalValue"
                        class="input-real full-width full-height"
                        :placeholder="!internalValue ? placeholder : ''"
                        spellcheck="false"
                        autocomplete="off"
                        @input="onInput"
                        @scroll="syncScroll"
                        @keydown="onKeydown"
                        @blur="delayedHideSuggestions"
                        @focus="onBoxFocus"
                    />
                </div>
            </template>

            <template #prepend>
                <q-icon name="sym_o_search" class="q-ml-xs" />
            </template>
            <template #append>
                <q-icon
                    v-if="internalValue"
                    name="sym_o_close"
                    class="cursor-pointer"
                    @click="clear"
                />
                <slot name="append-actions">
                    <q-btn
                        flat
                        dense
                        icon="sym_o_tune"
                        class="advanced-filter-btn"
                        @click="toggleAdvanced"
                    >
                        <q-tooltip>Advanced Filters</q-tooltip>
                    </q-btn>
                </slot>
            </template>
        </q-field>

        <!-- Validation Error Message -->
        <div
            v-if="errorMessage"
            class="text-negative text-caption q-pl-sm q-mt-xs"
        >
            {{ errorMessage }}
        </div>

        <!-- Autocomplete Dropdown -->
        <AutocompleteDropdown
            v-if="showSuggestions"
            :suggestions="filteredSuggestions"
            :selected-index="selectedIndex"
            @select="applySuggestion"
        />
    </div>
</template>

<script setup lang="ts">
import AutocompleteDropdown from 'components/common/autocomplete-dropdown.vue';
import { QField } from 'quasar';
import {
    Suggestion,
    SuggestionProvider,
} from 'src/services/suggestions/suggestion-types';
import { computed, nextTick, onMounted, ref, watch } from 'vue';

const props = defineProps<{
    modelValue: string;
    // Generic Provider
    provider: SuggestionProvider;
    // Context Data passed to provider
    contextData: unknown;
    // Keys to highlight (e.g. ['project:', 'mission:', ...])
    highlightKeys?: string[];
    validator?: (value: string) => string | null;
    placeholder?: string;
}>();

const emit = defineEmits<{
    (event: 'update:modelValue', value: string): void;
    (event: 'submit' | 'toggle-advanced'): void;
}>();

const inputReference = ref<HTMLInputElement | null>(null);
const mirrorReference = ref<HTMLElement | null>(null);
const fieldReference = ref<QField | null>(null);
const internalValue = ref(props.modelValue);
const showSuggestions = ref(false);
const selectedIndex = ref(0);

const errorMessage = computed(() => {
    if (props.validator) {
        return props.validator(internalValue.value);
    }
    return null;
});

onMounted(() => {
    if (props.modelValue && props.modelValue !== internalValue.value) {
        internalValue.value = props.modelValue;
    }
});

// Watch props to update internal state (handling external changes)
watch(
    () => props.modelValue,
    (value) => {
        if (value !== internalValue.value) {
            internalValue.value = value;
        }
    },
);

const highlightedHtml = computed(() => {
    // If empty, return empty
    if (!internalValue.value) return '';

    const text = internalValue.value;
    const keys = props.highlightKeys ?? [];

    if (keys.length === 0) return text;

    const escaped = text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');

    if (keys.length === 0) return escaped;

    const processedKeys = keys.map((k) =>
        k
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll(/[-[\]{}()*+?.,\\^$|#\s]/g, String.raw`\$&`),
    );

    const pattern = new RegExp(
        `((?:^|\\s)(?:${processedKeys.join('|')}))`,
        'gi',
    );

    // Wrap keywords in text-grey-8
    return escaped.replace(pattern, '<span class="text-grey-8">$1</span>');
});

function onInput() {
    emit('update:modelValue', internalValue.value);
    showSuggestions.value = true;
    selectedIndex.value = 0;

    // Sync scroll immediately after input
    void nextTick(() => {
        syncScroll();
    });
}

function syncScroll() {
    if (inputReference.value && mirrorReference.value) {
        mirrorReference.value.scrollLeft = inputReference.value.scrollLeft;
    }
}

function toggleAdvanced() {
    emit('toggle-advanced');
}

function focusInput(options?: Event) {
    // Handle legacy Event parameter
    const event = options instanceof Event ? options : undefined;

    // If clicked on advanced filter button, prevent focusing input
    if (
        event?.target instanceof Element &&
        event.target.closest('.advanced-filter-btn')
    ) {
        return;
    }

    if (inputReference.value) {
        inputReference.value.focus();
        showSuggestions.value = true;

        // Set caret to the very end
        void nextTick(() => {
            if (inputReference.value) {
                inputReference.value.selectionStart =
                    inputReference.value.value.length;
                inputReference.value.selectionEnd =
                    inputReference.value.value.length;
                syncScroll();
            }
        });
    }
}

function onBoxFocus() {
    showSuggestions.value = true;
}

function onKeydown(event: KeyboardEvent) {
    switch (event.key) {
        case 'ArrowDown': {
            event.preventDefault();
            navigateSuggestions(1);
            break;
        }
        case 'ArrowUp': {
            event.preventDefault();
            navigateSuggestions(-1);
            break;
        }
        case 'Enter': {
            event.preventDefault();
            selectSuggestion();
            break;
        }
        case 'Escape': {
            showSuggestions.value = false;
            break;
        }
    }
}

function clear() {
    internalValue.value = '';
    emit('update:modelValue', '');
    emit('submit');
    focusInput();
}

function delayedHideSuggestions() {
    setTimeout(() => {
        showSuggestions.value = false;
    }, 200);
}

// --- Suggestion Logic ---

const filteredSuggestions = computed(() => {
    return props.provider.getSuggestions({
        input: internalValue.value,
        data: props.contextData,
    });
});

function navigateSuggestions(step: number) {
    if (!showSuggestions.value) return;
    const length = filteredSuggestions.value.length;
    if (length === 0) return;
    selectedIndex.value = (selectedIndex.value + step + length) % length;
}

function selectSuggestion() {
    if (!showSuggestions.value || filteredSuggestions.value.length === 0) {
        emit('submit');
        showSuggestions.value = false;
        return;
    }
    const suggestion = filteredSuggestions.value[selectedIndex.value];
    if (suggestion) {
        applySuggestion(suggestion);
    }
}

function applySuggestion(suggestion: Suggestion) {
    if (suggestion.disabled) return;

    const input = internalValue.value;
    const lastWordRegex =
        /([a-zA-Z0-9_-]+:"[^"]*|[a-zA-Z0-9_:=><!\/.\-@#~"&]+)$/;

    let toInsert = suggestion.prefix + suggestion.value;
    // Quote handling
    if (
        suggestion.value &&
        suggestion.value.includes(' ') &&
        !/[=><!]/.test(suggestion.label)
    ) {
        toInsert = `${suggestion.prefix}"${suggestion.value}"`;
    } else if (!suggestion.value) {
        toInsert = suggestion.prefix;
    }

    const endsWithEquals = toInsert.endsWith('=');
    const shouldAddSpace =
        suggestion.appendSpace !== false &&
        !!suggestion.value &&
        suggestion.value.length > 0 &&
        !endsWithEquals;

    let newValue;
    const match = lastWordRegex.exec(input);

    if (match) {
        const token = match[0];
        const tokenIndex = match.index;

        // Check if the current token contains the prefix
        const prefixInTokenIndex = token.lastIndexOf(suggestion.prefix);

        if (prefixInTokenIndex === -1) {
            // Token doesn't contain prefix (e.g. typing "fil" -> "filetype:"), replace whole token
            const before = input.slice(0, tokenIndex);
            newValue = before + toInsert;
        } else {
            // If token contains prefix, replace from there
            const before = input.slice(0, tokenIndex + prefixInTokenIndex);
            newValue = before + toInsert;
        }
    } else {
        // No token match (start of line?), just append
        newValue = input + toInsert;
    }

    if (shouldAddSpace) {
        newValue += ' ';
    }

    internalValue.value = newValue;
    emit('update:modelValue', newValue);

    void nextTick(() => {
        focusInput();

        // Restore focus and set caret properly
        if (inputReference.value) {
            inputReference.value.focus();
            inputReference.value.selectionStart = newValue.length;
            inputReference.value.selectionEnd = newValue.length;
            syncScroll();
        }

        // If it's a keyword-only suggestion (value is empty), we should NOT submit
        // and keeps suggestions open (or re-open them to show values if applicable)
        const isKeywordOnly = !suggestion.value; // e.g. "project:"

        if (isKeywordOnly || endsWithEquals) {
            showSuggestions.value = true;
        } else {
            showSuggestions.value = false;
            // Trigger search after selecting a value (e.g. "project:MyProject")
            emit('submit');
        }
    });
}
</script>

<style scoped>
.smart-filter-input {
    width: 100%;
}

.input-container {
    position: relative;
    display: flex;
    align-items: center;
}

.input-mirror,
.input-real {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    /* Strict CSS Reset for Alignment */
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;

    /* Font Inheritance */
    font-family: inherit;
    font-size: inherit;
    letter-spacing: inherit;
    font-weight: inherit;
    text-align: inherit;

    box-sizing: border-box;
}

.input-mirror {
    white-space: pre;
    overflow: hidden;
    pointer-events: none;

    /* Colors */
    color: black;
    background: transparent;

    /* Vertical alignment for text in div */
    display: flex;
    align-items: center;
}

.input-real {
    color: transparent !important;
    caret-color: black;
    background: transparent !important;
    outline: none;
    text-indent: 0;

    /* Prevent text shadow causing ghosting */
    text-shadow: none !important;
    -webkit-text-fill-color: transparent !important;
}

.input-real::placeholder {
    color: #9e9e9e;
    -webkit-text-fill-color: #9e9e9e !important;
    opacity: 1;
}
</style>
