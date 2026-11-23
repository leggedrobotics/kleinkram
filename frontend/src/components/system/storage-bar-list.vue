<template>
    <ol class="bar-list">
        <li v-for="item in items" :key="item.key">
            <component
                :is="item.to ? RouterLink : 'div'"
                :to="item.to"
                class="bar-list__row"
                :class="{ 'bar-list__row--link': !!item.to }"
                :title="`${item.name}: ${formatSize(item.bytes)} (${percent(item.bytes)})`"
            >
                <div class="bar-list__name">
                    {{ item.name }}
                    <span v-if="item.sub" class="bar-list__sub">
                        {{ item.sub }}
                    </span>
                </div>
                <div class="bar-list__track" aria-hidden="true">
                    <div
                        class="bar-list__fill"
                        :class="{ 'bar-list__fill--other': item.other }"
                        :style="{ width: barWidth(item.bytes) }"
                    />
                </div>
                <div class="bar-list__value">
                    {{ formatSize(item.bytes) }}
                    <span class="bar-list__sub">{{ percent(item.bytes) }}</span>
                </div>
            </component>
        </li>
    </ol>
</template>

<script setup lang="ts">
/**
 * A ranked list of horizontal bars, e.g. storage per project: name and
 * sub-line on the left, the bar (scaled to the largest entry) and value with
 * share of `total` on the right. Rows with `to` link there.
 */
import type { StorageBarItem } from 'components/system/storage-bar-item';
import { formatSize } from 'src/services/general-formatting';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

const { items, total } = defineProps<{
    items: StorageBarItem[];
    /** what the percentages are shares of */
    total: number;
}>();

const largest = computed(() => Math.max(...items.map((item) => item.bytes), 1));

const barWidth = (bytes: number): string =>
    `${String(Math.max((bytes / largest.value) * 100, bytes > 0 ? 1 : 0))}%`;

const percent = (bytes: number): string => {
    if (total <= 0) return '0%';
    const share = (bytes / total) * 100;
    return share > 0 && share < 1 ? '<1%' : `${String(Math.round(share))}%`;
};
</script>

<style scoped>
.bar-list {
    margin: 0;
    padding: 0;
    list-style: none;
}

.bar-list__row {
    display: grid;
    grid-template-columns: minmax(0, 160px) minmax(0, 1fr) 84px;
    gap: 12px;
    align-items: center;
    padding: 6px 8px;
    margin: 0 -8px;
    border-radius: 4px;
    color: #161616;
    text-decoration: none;
}

/* $layer-hover */
.bar-list__row--link:hover,
.bar-list__row--link:focus-visible {
    background: #f4f4f4;
}

.bar-list__name {
    min-width: 0;
    overflow: hidden;
    font-size: 13px;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* $text-helper */
.bar-list__sub {
    display: block;
    overflow: hidden;
    color: #6f6f6f;
    font-size: 12px;
    text-overflow: ellipsis;
}

.bar-list__track {
    height: 12px;
}

/* square at the baseline, rounded at the end; $link-primary */
.bar-list__fill {
    height: 12px;
    border-radius: 0 4px 4px 0;
    background: #0f62fe;
}

/* $button-disabled */
.bar-list__fill--other {
    background: #c6c6c6;
}

.bar-list__value {
    font-size: 13px;
    text-align: right;
    white-space: nowrap;
}
</style>
