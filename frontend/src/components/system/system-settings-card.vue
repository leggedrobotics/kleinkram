<template>
    <div class="system-card" style="background-color: white">
        <q-card class="full-width q-pa-md" flat>
            <span style="font-size: larger">Settings</span>
        </q-card>

        <q-separator />

        <q-item tag="label">
            <q-item-section>
                <q-item-label>Foxglove preview</q-item-label>
                <q-item-label caption>
                    Preview tab in missions. Projects can also turn it off.
                    Foxglove links stay available.
                </q-item-label>
            </q-item-section>
            <q-item-section side>
                <q-toggle
                    :model-value="settings?.foxglovePreviewEnabled ?? true"
                    :disable="!settings || isPending"
                    color="primary"
                    @update:model-value="setFoxglovePreview"
                />
            </q-item-section>
        </q-item>
    </div>
</template>

<script setup lang="ts">
import type { SystemSettingsDto } from '@kleinkram/api-dto/types/system-settings.dto';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify } from 'quasar';
import {
    SYSTEM_SETTINGS_QUERY_KEY,
    useSystemSettings,
} from 'src/composables/use-foxglove-preview';
import { getErrorMessage } from 'src/services/error-handling';
import { updateSystemSettings } from 'src/services/mutations/system';

const queryClient = useQueryClient();
const { data: settings } = useSystemSettings();

const { mutate, isPending } = useMutation({
    mutationFn: updateSystemSettings,
    onSuccess: (updated: SystemSettingsDto) => {
        queryClient.setQueryData(SYSTEM_SETTINGS_QUERY_KEY, updated);
    },
    onError: (error: unknown) => {
        Notify.create({
            message: `Could not save the setting: ${getErrorMessage(error)}`,
            color: 'negative',
            position: 'bottom',
        });
    },
});

function setFoxglovePreview(value: boolean): void {
    mutate({ foxglovePreviewEnabled: value });
}
</script>
