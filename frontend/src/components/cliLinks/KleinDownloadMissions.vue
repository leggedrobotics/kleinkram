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
                    klein mission download
                    <span style="opacity: 0.8"> {{ params }} </span>
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
import { Mission } from 'src/types/Mission';
import { computed } from 'vue';

const props = defineProps<{
    missions: Mission[];
}>();

const params = computed(() => {
    return (
        props.missions
            .map((mission) => mission.uuid)
            .map((uuid) => `--mission-uuid="${uuid}"`)
            .join(' ') + ' --local-path="."'
    );
});

function clicked() {
    const text = `klein mission download ${params.value}`;
    navigator.clipboard.writeText(text);
}
</script>
<style scoped></style>
