<template>
    <q-input
        ref="inputReference"
        :model-value="modelValue"
        :for="id"
        :name="id"
        outlined
        dense
        no-error-icon
        lazy-rules
        color="button-primary"
        :autofocus="autofocus"
        :hint="hint"
        :rules="[rule]"
        :error="serverError ? true : undefined"
        :class="{ 'name-field--suffixed': suffix !== undefined }"
        @update:model-value="onInput"
    >
        <template #error>
            <span class="name-field__error">
                {{ serverError || shortError(modelValue) }}
                <button
                    v-if="!serverError && suggestion"
                    type="button"
                    class="name-field__suggestion"
                    @click="applySuggestion"
                >
                    Use {{ suggestion }}
                </button>
            </span>
        </template>
        <template v-if="suffix !== undefined" #append>
            <span class="name-field__suffix">{{ suffix }}</span>
        </template>
        <template v-else-if="$slots.append" #append>
            <slot name="append" />
        </template>
    </q-input>
</template>

<script setup lang="ts">
/**
 * An input for a name with the naming rules of projects, missions, access
 * groups (`kind="name"`) or files (`kind="file"`).
 *
 * With `suffix` (files only), the value is the base name and the suffix,
 * e.g. ".bag", is shown fixed after it and can't be changed.
 *
 * It validates only itself: after the first blur (or when the form is
 * validated on submit), then live while typing. Put it in a q-form so the
 * dialog can validate every field when its main action is pressed.
 */
import {
    FILE_EXTENSIONS,
    FILENAME_MAX_LENGTH,
    FILENAME_MIN_LENGTH,
    NAME_ALLOWED_CHARACTERS,
    NAME_MAX_LENGTH,
    NAME_MIN_LENGTH,
    NON_UUID_REGEX,
    splitFileName,
    suggestFileName,
    suggestName,
} from '@kleinkram/validation/frontend';
import { QInput } from 'quasar';
import { computed, ref } from 'vue';

const {
    modelValue,
    id,
    label,
    kind = 'name',
    autofocus,
    serverError = '',
    hint = 'Letters, digits, ".", "-" and "_"',
    accepted,
    suffix,
} = defineProps<{
    modelValue: string;
    /** id of the input, the `for` of its label */
    id: string;
    /** what the name is, for the required message, e.g. "Project name" */
    label: string;
    kind?: 'name' | 'file';
    autofocus?: boolean;
    /** a rejection from the server, e.g. the name is already taken */
    serverError?: string;
    hint?: string;
    /** a value that is valid as-is, e.g. a name from before the naming rules */
    // eslint-disable-next-line vue/require-default-prop
    accepted?: string | undefined;
    /** a fixed file ending after the base name, e.g. ".bag" (kind="file") */
    // eslint-disable-next-line vue/require-default-prop
    suffix?: string | undefined;
}>();

const emit = defineEmits<{
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'update:modelValue': [value: string];
    /** the user changed the value (clears a server error in the parent) */
    edit: [];
}>();

const inputReference = ref<QInput>();

const INVALID_CHARACTER = new RegExp(`[^${NAME_ALLOWED_CHARACTERS}]`, 'g');

/** One short line telling what is wrong with the name part */
function namePartError(name: string, min: number, max: number): string {
    if (name.length < min) return `At least ${String(min)} characters.`;
    if (name.length > max) return `At most ${String(max)} characters.`;
    if (!NON_UUID_REGEX.test(name)) return "Can't be a UUID.";
    const invalid = new Set(name.match(INVALID_CHARACTER));
    if (invalid.size === 1 && invalid.has(' ')) return "Spaces aren't allowed.";
    if (invalid.size > 0) return 'Only letters, digits, ".", "-" and "_".';
    if (/^[.-]/.test(name)) return 'Can\'t start with "." or "-".';
    return '';
}

/** One short line telling what is wrong, empty if the value is valid */
function shortError(value: string): string {
    if (!value) return `${label} is required.`;
    if (accepted !== undefined && value.trim() === accepted) return '';
    if (kind === 'name') {
        return namePartError(value, NAME_MIN_LENGTH, NAME_MAX_LENGTH);
    }
    if (suffix !== undefined) {
        if (suffix !== '' && !FILE_EXTENSIONS.includes(suffix))
            return 'Unsupported file extension.';
        return namePartError(value, FILENAME_MIN_LENGTH, FILENAME_MAX_LENGTH);
    }
    const { name, extension } = splitFileName(value);
    if (!FILE_EXTENSIONS.includes(extension)) {
        return FILE_EXTENSIONS.includes(extension.toLowerCase())
            ? 'Use a lowercase extension.'
            : 'Unsupported file extension.';
    }
    return namePartError(name, FILENAME_MIN_LENGTH, FILENAME_MAX_LENGTH);
}

// returns false rather than the message: Quasar only renders the #error
// slot (message plus "Use <suggestion>") when the rule gives no text
const rule = (value: string): boolean => shortError(value) === '';

const suggestion = computed(() => {
    if (!modelValue) return;
    let suggested: string | undefined;
    if (kind === 'name') suggested = suggestName(modelValue);
    else if (suffix === undefined) suggested = suggestFileName(modelValue);
    // only the base name: the ending stays as it is
    else suggested = suggestName(modelValue)?.slice(0, FILENAME_MAX_LENGTH);
    return suggested === modelValue ? undefined : suggested;
});

function onInput(value: string | number | null): void {
    emit('update:modelValue', String(value ?? ''));
    emit('edit');
}

function applySuggestion(): void {
    if (suggestion.value === undefined) return;
    emit('update:modelValue', suggestion.value);
    emit('edit');
    inputReference.value?.focus();
}
</script>

<style scoped>
/* the naming rules as helper text, $text-secondary */
.q-field:not(.q-field--error) :deep(.q-field__bottom) {
    color: #525252;
}

/*
 * The fixed file ending, attached to the right edge of the input:
 * $layer-02 background, $border-strong line, $text-secondary text
 */
.name-field--suffixed :deep(.q-field__append) {
    align-self: stretch;
    height: auto;
    margin-right: -12px;
    padding-left: 0;
}

.name-field__suffix {
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 12px;
    border-left: 1px solid #c6c6c6;
    border-radius: 0 4px 4px 0;
    background: #f4f4f4;
    color: #525252;
    font-size: 14px;
}

.name-field__error {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0 8px;
}

/* $link-primary */
.name-field__suggestion {
    padding: 0;
    border: 0;
    background: none;
    color: #0f62fe;
    font: inherit;
    cursor: pointer;
    overflow-wrap: anywhere;
}

.name-field__suggestion:hover {
    text-decoration: underline;
}
</style>
