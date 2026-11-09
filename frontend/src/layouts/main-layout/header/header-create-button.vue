<template>
    <div style="background-color: #0f62fe; border-radius: 4px 0 0 4px">
        <q-icon
            name="sym_o_add"
            class="q-mx-xs"
            style="height: 36px; display: inline-flex"
        />
        <span v-if="$q.screen.gt.xs" class="q-mr-md"> New </span>
        <span v-else class="q-mr-xs" />
    </div>
    <q-separator vertical class="separator" />
    <q-icon
        style="
            background-color: #0f62fe;
            height: 36px;
            display: inline-flex;
            border-radius: 0 4px 4px 0;
        "
        name="sym_o_arrow_drop_down"
        class="q-my-sm"
    />
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';

const $q = useQuasar();
</script>

<style scoped>
.separator {
    background-color: white;

    /*
    * we need to set the width to 1.2px to make it visible
     * otherwise Chrome will not render the separator at
     * certain zoom levels
     */
    width: 1.2px;
}
</style>
