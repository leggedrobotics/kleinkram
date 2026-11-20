import { getDialogErrorMessage } from 'src/services/error-handling';
import { ref, type Ref } from 'vue';

/**
 * Runs a confirm dialog's request while the dialog stays open: the main
 * button shows `running`, the dialog closes (`close`) only on success, and a
 * failure is shown in the dialog's error strip (`errorMessage`, bind it with
 * `v-model:error`) so the user can retry.
 *
 * @param close closes the dialog, e.g. `onDialogOK` or `() => onDialogOK(x)`
 */
export const useDialogAction = (
    close: () => void,
): {
    running: Ref<boolean>;
    errorMessage: Ref<string>;
    run: (action: () => Promise<unknown>) => Promise<void>;
} => {
    const running = ref(false);
    const errorMessage = ref('');

    const run = async (action: () => Promise<unknown>): Promise<void> => {
        if (running.value) return;
        running.value = true;
        errorMessage.value = '';
        try {
            await action();
        } catch (error: unknown) {
            errorMessage.value = getDialogErrorMessage(error);
            return;
        } finally {
            running.value = false;
        }
        close();
    };

    return { running, errorMessage, run };
};
