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
                        echo {{ params }} | xargs -n 1
                    </span>
                    klein download
                    <span style="opacity: 0.8"> --dest=. </span>
                </div>
                <q-btn
                    icon="sym_o_content_copy"
                    flat
                    style="padding: 3px; color: white; rotate: 180deg"
                    @click.stop="clicked"
                />
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { MissionWithFilesDto } from '@api/types/Mission.dto';

const properties = defineProps<{
    missions: MissionWithFilesDto[];
}>();

const params = computed(() => {
    return properties.missions
        .map((mission) => mission.uuid.toString())
        .join(' ');
});

const clicked = async (): Promise<void> => {
    const text = `echo ${params.value} | xargs -n 1 klein download --dest=. -m`;
    await navigator.clipboard.writeText(text);
};
</script>
<style scoped></style>
