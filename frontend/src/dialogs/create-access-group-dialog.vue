<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="creating"
        :dirty="name !== ''"
        :submit-disabled="creating"
        @submit="createAction"
    >
        <template #title>Create Access Group</template>

        <template #content>
            <q-form ref="formReference" greedy @submit.prevent>
                <label :for="nameId">
                    Name<span class="text-error">*</span>
                </label>
                <NameField
                    :id="nameId"
                    v-model="name"
                    label="Group name"
                    autofocus
                    :server-error="serverNameError"
                    @edit="clearServerNameError"
                />
            </q-form>
        </template>

        <template #actions>
            <q-btn
                flat
                no-caps
                label="Create Access Group"
                class="bg-button-primary"
                :loading="creating"
                @click="createAction"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import NameField from 'components/common/name-field.vue';
import { Notify, QForm, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import {
    focusField,
    getDialogErrorMessage,
    getErrorMessage,
    isNameError,
} from 'src/services/error-handling';
import { createAccessGroup } from 'src/services/mutations/access';
import { ref, useId } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const queryClient = useQueryClient();

const nameId = `create-access-group-name-${useId()}`;
const name = ref('');
const creating = ref(false);
const errorMessage = ref('');
// the server rejected the name, e.g. it is already taken
const serverNameError = ref('');
const clearServerNameError = (): void => {
    serverNameError.value = '';
};
const formReference = ref<QForm>();

async function createAction(): Promise<void> {
    if (creating.value) return;
    if (!(await formReference.value?.validate(true))) return;
    creating.value = true;
    errorMessage.value = '';
    try {
        await createAccessGroup(name.value);
    } catch (error: unknown) {
        if (isNameError(error)) {
            // e.g. the name is already taken: shown on the name field
            serverNameError.value = getErrorMessage(error);
            focusField(nameId);
        } else {
            errorMessage.value = getDialogErrorMessage(error);
        }
        return;
    } finally {
        creating.value = false;
    }

    Notify.create({
        message: 'Access Group Created',
        color: 'positive',
        position: 'bottom',
        timeout: 2000,
    });
    onDialogOK();
    await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'accessGroups',
    });
}
</script>
