<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete Mission</template>
        <template #content>
            <delete-mission
                v-if="mission"
                ref="deleteMissionRef"
                :mission="mission"
            />
            <q-skeleton v-else height="250px" />
        </template>

        <template #actions>
            <q-btn
                flat
                :disable="
                    deleteMissionRef?.mission_name_check !== mission?.name
                "
                label="Delete Mission"
                class="bg-button-primary"
                @click="deleteMissionAction"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from './base-dialog.vue';
import { computed, ref } from 'vue';
import { useMission } from 'src/hooks/customQueryHooks';
import DeleteMission from '../components/DeleteMission.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const deleteMissionRef = ref<InstanceType<typeof DeleteMission> | null>(null);

const { missionUuid } = defineProps<{
    missionUuid: string;
}>();

const { data: mission } = useMission(computed(() => missionUuid));

const deleteMissionAction = (): void => {
    if (deleteMissionRef.value === null) return;
    deleteMissionRef.value.deleteMissionAction();
    onDialogOK();
};
</script>
