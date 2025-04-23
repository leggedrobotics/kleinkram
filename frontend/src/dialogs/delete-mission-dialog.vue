<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete Mission</template>
        <template #content>
            <delete-mission
                v-if="mission"
                ref="deleteMissionReference"
                :mission="mission"
            />
            <q-skeleton v-else height="250px" />
        </template>

        <template #actions>
            <q-btn
                flat
                :disable="
                    deleteMissionReference?.mission_name_check !== mission?.name
                "
                label="Delete Mission"
                class="bg-button-danger"
                @click="deleteMissionAction"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { computed, ref } from 'vue';
import { useMission } from 'src/hooks/query-hooks';
import DeleteMission from 'components/delete-mission.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const deleteMissionReference = ref<
    InstanceType<typeof DeleteMission> | undefined
>(undefined);

const { missionUuid } = defineProps<{
    missionUuid: string;
}>();

const { data: mission } = useMission(computed(() => missionUuid));

const deleteMissionAction = (): void => {
    if (deleteMissionReference.value === undefined) return;
    deleteMissionReference.value.deleteMissionAction();
    onDialogOK();
};
</script>
