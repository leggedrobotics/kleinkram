<template>
    <q-dialog
        ref="dialogRef"
        :persistent="dirty || busy"
        :aria-labelledby="titleId"
        @hide="onDialogHide"
        @shake="requestClose"
    >
        <q-card
            class="base-dialog"
            :class="[
                `base-dialog--${size}`,
                { 'base-dialog--fixed-height': fixedHeight },
            ]"
        >
            <header class="base-dialog__header">
                <div class="base-dialog__heading">
                    <h2 :id="titleId" class="base-dialog__title">
                        <slot name="title" />
                    </h2>
                    <div v-if="$slots.subtitle" class="base-dialog__subtitle">
                        <slot name="subtitle" />
                    </div>
                </div>
                <q-btn
                    flat
                    round
                    dense
                    icon="sym_o_close"
                    aria-label="Close"
                    class="base-dialog__close"
                    :disable="busy"
                    @click="requestClose"
                />
            </header>

            <div v-if="$slots.tabs" class="base-dialog__tabs">
                <slot name="tabs" />
            </div>

            <div
                v-if="$slots.content"
                class="base-dialog__content"
                :inert="busy"
                @keydown.enter="onEnter"
                @input="clearError"
            >
                <slot name="content" />
            </div>

            <div v-if="error" class="base-dialog__error" role="alert">
                <q-icon name="sym_o_error" size="20px" />
                <span>{{ error }}</span>
            </div>

            <footer class="base-dialog__actions">
                <div v-if="$slots['footer-start']" class="base-dialog__start">
                    <slot name="footer-start" />
                </div>
                <q-btn
                    v-if="!hideCancel"
                    flat
                    no-caps
                    :label="cancelLabel"
                    class="button-border base-dialog__cancel"
                    :disable="busy"
                    @click="requestClose"
                />
                <slot name="actions" />
            </footer>
        </q-card>
    </q-dialog>
</template>

<script setup lang="ts">
/**
 * The frame every dialog uses: a title with a close button, optional tabs,
 * the content, and a grey band with Cancel and the dialog's own actions.
 *
 * Put the dialog's action buttons in the `actions` slot, after the Cancel
 * button the frame adds: `bg-button-primary` for the main action,
 * `bg-button-danger` when it deletes or ends something.
 *
 * When the main action is enabled:
 * - Forms (create, edit, move, …): always enabled, except while saving
 *   (`:loading`). Pressing it validates every field (q-form `validate(true)`)
 *   and focuses the first invalid one instead of proceeding.
 * - "Nothing to do yet" (type-to-confirm deletes, an empty selection, no
 *   date picked, moving to the current location): disabled, wrapped in
 *   `<span class="disabled-reason">` with a q-tooltip giving the reason,
 *   e.g. "Type the name to confirm".
 * Fields in dialogs use `no-error-icon`.
 *
 * - `dirty`: the form has unsaved changes; closing it (Esc, backdrop, the
 *   close button, Cancel) asks before discarding them.
 * - `busy`: the dialog's request is running. Until it ends the dialog cannot
 *   be closed (Esc, backdrop, the close button, Cancel), its content cannot
 *   be changed (the request was built from what is shown) and Enter does not
 *   submit: the caller only hears about the result while the dialog is
 *   mounted. Pass the same flag the main button uses for `:loading`.
 * - `error` (use `v-model:error`): an error that belongs to no field, e.g.
 *   no connection or no permission, shown in a strip above the footer that
 *   stays visible while the content scrolls. Cleared when the user types.
 *   Errors about one field go under that field instead.
 * - `submit`: emitted when Enter is pressed in a single-line input, unless
 *   `submitDisabled` is set. Bind it to the dialog's main action.
 */
import { Dialog, useDialogPluginComponent } from 'quasar';
import ConfirmDialog from 'src/dialogs/confirm-dialog.vue';
import { useId } from 'vue';

const {
    size = 'md',
    cancelLabel = 'Cancel',
    hideCancel,
    dirty,
    busy,
    error = '',
    submitDisabled,
    fixedHeight,
} = defineProps<{
    /** sm for a question, md for a form, lg for tables and wide forms */
    size?: 'sm' | 'md' | 'lg';
    cancelLabel?: string;
    /** Leave out the Cancel button, e.g. when the dialog only informs */
    hideCancel?: boolean;
    /** The form has unsaved changes: ask before closing */
    dirty?: boolean;
    /** The dialog's request is running: it cannot be closed until it ends */
    busy?: boolean;
    /** An error to show under the content, e.g. from a failed save */
    error?: string;
    /** Enter does not submit, e.g. while the main action is disabled */
    submitDisabled?: boolean;
    /**
     * One height whatever the step or data, for tabbed and multi-step
     * dialogs: only the content scrolls, the footer never moves
     */
    fixedHeight?: boolean;
}>();

const emit = defineEmits([
    ...useDialogPluginComponent.emits,
    'submit',
    'update:error',
]);

const { dialogRef, onDialogHide, onDialogCancel } = useDialogPluginComponent();

const titleId = `base-dialog-title-${useId()}`;

/** Typing again clears a shown error */
function clearError(): void {
    if (error) emit('update:error', '');
}

/** Close with Cancel semantics, asking first if there are unsaved changes */
function requestClose(): void {
    if (busy) return;
    if (!dirty) {
        onDialogCancel();
        return;
    }
    Dialog.create({
        component: ConfirmDialog,
        componentProps: {
            title: 'Discard Changes?',
            okLabel: 'Discard',
            cancelLabel: 'Keep Editing',
            danger: true,
        },
    }).onOk(onDialogCancel);
}

// not `search`: Enter in a search or filter box must not run the main action
const TEXT_INPUT_TYPES = new Set([
    'text',
    'email',
    'url',
    'tel',
    'number',
    'password',
]);

/** Enter in a single-line input submits the dialog (never in a textarea) */
function onEnter(event: KeyboardEvent): void {
    const target = event.target;
    if (
        event.defaultPrevented ||
        event.isComposing ||
        event.shiftKey ||
        !(target instanceof HTMLInputElement) ||
        !TEXT_INPUT_TYPES.has(target.type) ||
        // Enter picks an option in a select's filter input
        target.closest('.q-select') !== null
    ) {
        return;
    }
    // also when disabled: a q-form would otherwise submit the page natively
    event.preventDefault();
    if (!submitDisabled && !busy) emit('submit');
}

// the dialog components built on this frame call show() and hide() through
// their ref to it (Quasar's useDialogPluginComponent)
defineExpose({
    show: (): void => {
        dialogRef.value?.show();
    },
    hide: (): void => {
        dialogRef.value?.hide();
    },
});
</script>

<style scoped>
.base-dialog {
    display: flex;
    flex-direction: column;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 48px);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
}

.base-dialog--sm {
    width: 440px;
}

.base-dialog--md {
    width: 600px;
}

.base-dialog--lg {
    width: 840px;
}

.base-dialog--fixed-height {
    height: min(520px, calc(100vh - 48px));
}

.base-dialog--lg.base-dialog--fixed-height {
    height: min(600px, calc(100vh - 48px));
}

.base-dialog__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 16px 0 24px;
}

.base-dialog__heading {
    min-width: 0;
    margin-top: 4px;
}

/* $text-primary */
.base-dialog__title {
    margin: 0;
    color: #161616;
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.75rem;
    letter-spacing: 0;
    overflow-wrap: anywhere;
}

/* $text-secondary; user-provided names, e.g. the file being moved */
.base-dialog__subtitle {
    margin-top: 2px;
    color: #525252;
    font-family: monospace;
    font-size: 12px;
    line-height: 1rem;
    overflow-wrap: anywhere;
}

.base-dialog__close {
    flex: none;
    color: #161616;
}

/* the tabs must not widen the dialog: they scroll inside their row */
.base-dialog__tabs {
    min-width: 0;
    margin: 8px 24px 0;
    border-bottom: 1px solid #e0e0e0;
}

/* with no content, the header needs space above the footer */
.base-dialog__header:has(+ .base-dialog__actions),
.base-dialog__header:has(+ .base-dialog__error) {
    padding-bottom: 24px;
}

.base-dialog__content {
    flex: 1 1 auto;
    min-height: 0;
    padding: 16px 24px 24px;
    overflow-y: auto;
    color: #161616;
}

/*
 * Fixed between the scrolling content and the footer, so it is always
 * visible: $support-error line and icon, $text-primary text
 */
.base-dialog__error {
    display: flex;
    flex: none;
    align-items: flex-start;
    gap: 8px;
    margin: 0;
    padding: 8px 24px 8px 21px;
    border-top: 1px solid #ffd7d9;
    border-left: 3px solid #da1e28;
    background: #fff1f1;
    color: #161616;
    overflow-wrap: anywhere;
}

.base-dialog__error .q-icon {
    flex: none;
    color: #da1e28;
}

.base-dialog__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 24px;
    border-top: 1px solid #e0e0e0;
    border-radius: 0 0 8px 8px;
    background: #f4f4f4;
}

/* secondary actions sit at the left end of the footer */
.base-dialog__start {
    display: flex;
    gap: 8px;
    margin-right: auto;
}

.base-dialog__cancel {
    background: #ffffff;
}

@media (max-width: 599px) {
    .base-dialog {
        width: 100%;
    }

    .base-dialog__header {
        padding: 16px 8px 0 16px;
    }

    .base-dialog__tabs {
        margin: 8px 16px 0;
    }

    .base-dialog__content {
        padding: 16px;
    }

    .base-dialog__actions {
        padding: 12px 16px;
    }

    .base-dialog__error {
        padding: 8px 16px 8px 13px;
    }
}
</style>
