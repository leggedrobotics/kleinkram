<template>
    <div v-if="visible" class="select-all-banner" role="status">
        <template v-if="allMatchingSelected">
            <span>
                All <b>{{ formattedTotal }}</b> matching
                {{ nounFor(total) }} are selected.
            </span>
            <q-btn
                flat
                dense
                no-caps
                class="select-all-banner__action"
                label="Clear selection"
                @click="onClear"
            />
        </template>

        <!--
            Above the cap the server would reject the query, so the affordance
            is withheld rather than offered and then failed. The real total is
            still named: a silent page-scoped selection is the thing this
            banner exists to prevent.
        -->
        <template v-else-if="exceedsLimit">
            <span>
                All <b>{{ formattedPageCount }}</b> {{ nounFor(pageCount) }} on
                this page are selected &mdash; <b>{{ formattedTotal }}</b> match
                the current filters.
            </span>
            <span class="select-all-banner__note">
                Selecting them all at once is capped at {{ formattedLimit }}.
            </span>
        </template>

        <template v-else>
            <span>
                All <b>{{ formattedPageCount }}</b> {{ nounFor(pageCount) }} on
                this page are selected.
            </span>
            <q-btn
                flat
                dense
                no-caps
                :loading="busy"
                class="select-all-banner__action"
                :label="`Select all ${formattedTotal} matching`"
                @click="onSelectAll"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

/**
 * Tells people what "select all" actually selected, and offers the rest.
 *
 * A page-scoped select-all is silent about its scope: with 20 rows of 247 on
 * screen, "all selected" means 20 and nothing says so. This names both numbers
 * and lets the full result set be selected in one click.
 */
const props = defineProps({
    /** Every row of the current page is selected — the trigger for the offer. */
    allOnPageSelected: { type: Boolean, default: false },
    /**
     * The selection is known to cover the whole result set. Owned by the
     * parent, because only the parent knows whether the selection was made
     * against the filters that are in force now.
     */
    allMatchingSelected: { type: Boolean, default: false },
    /** Rows on the current page. */
    pageCount: { type: Number, default: 0 },
    /** Rows matching the current filters, across all pages. */
    total: { type: Number, default: 0 },
    /** Singular noun for the rows, e.g. `file`. */
    noun: { type: String, default: 'row' },
    /** The full set is being fetched. */
    busy: { type: Boolean, default: false },
    /** Largest set that can be selected in one request. */
    limit: { type: Number, default: 10_000 },
});

const emit = defineEmits(['select-all', 'clear']);

function onSelectAll(): void {
    emit('select-all');
}

function onClear(): void {
    emit('clear');
}

/**
 * Nothing to offer while the page already holds every matching row — then
 * "select all" was not page-scoped and needs no explanation.
 */
const visible = computed(
    () => props.allOnPageSelected && props.total > props.pageCount,
);

const exceedsLimit = computed(() => props.total > props.limit);

const format = (value: number): string => value.toLocaleString();

const formattedTotal = computed(() => format(props.total));
const formattedPageCount = computed(() => format(props.pageCount));
const formattedLimit = computed(() => format(props.limit));

function nounFor(count: number): string {
    return count === 1 ? props.noun : `${props.noun}s`;
}
</script>

<style scoped>
.select-all-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    padding: 8px 16px;
    background-color: #e7efff;
    border-bottom: 1px solid #c6d9ff;
    font-size: 14px;
    line-height: 20px;
    color: #161616;
}

.select-all-banner__action {
    color: #0f62fe;
    font-weight: 600;
    padding: 0 4px;
}

.select-all-banner__note {
    color: #525252;
}
</style>
