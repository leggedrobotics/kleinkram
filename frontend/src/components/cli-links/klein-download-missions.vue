<template>
    <div class="q-pa-sm">
        <div class="button-border">
            <div class="q-ml-sm row items-center no-wrap">
                <div
                    class="text-truncate"
                    style="
                        flex: 1 1 auto;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        color: white;
                    "
                >
                    <span style="opacity: 0.8">
                        echo {{ echoCommand }} | xargs -n 1
                    </span>
                    klein download
                    <span style="opacity: 0.8"> --dest=. </span>
                </div>
                <q-btn
                    icon="sym_o_content_copy"
                    flat
                    style="padding: 3px; color: white; rotate: 180deg"
                    @click.stop="copyCommandAction"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { FlatMissionDto } from '@api/types/mission/mission.dto';

const { missions } = defineProps<{
    missions: FlatMissionDto[];
}>();

const echoCommand = computed(() => {
    return missions.map((mission) => mission.uuid.toString()).join(' ');
});

const copyCommandAction = async (): Promise<void> => {
    const text = `echo ${echoCommand.value} | xargs -n 1 klein download --dest=. -m`;
    await navigator.clipboard.writeText(text);
};
</script>
