<template>
    <div class="q-pa-sm">
        <p style="font-size: medium; margin-bottom: 0" class="q-pa-sm">
            Kleinkram CLI:
        </p>
        <div class="button-border">
            <div class="q-ml-sm row items-center no-wrap">
                <div
                    class="text-truncate"
                    style="
                        flex: 1 1 auto;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        font-size: smaller;
                    "
                >
                    klein mission download
                    <span style="opacity: 0.8">
                        --mission-uuid="{{ props.mission.uuid }}"
                        --local-path="."
                    </span>
                </div>
                <q-btn
                    icon="sym_o_content_copy"
                    flat
                    style="padding: 3px; color: #0f62fe; rotate: 180deg"
                    @click.stop="clicked"
                />
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { Mission } from 'src/types/Mission';

const props = defineProps<{
    mission: Mission;
}>();

function clicked() {
    const text = `klein mission download --mission-uuid="${props.mission.uuid}" --local-path="."`;
    navigator.clipboard.writeText(text);
}
</script>
<style scoped></style>
