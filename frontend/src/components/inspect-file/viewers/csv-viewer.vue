<template>
    <div class="bg-white rounded-borders border-solid q-pa-md">
        <div class="row justify-between items-center q-mb-md">
            <div class="row items-center q-gutter-x-sm">
                <q-badge color="blue-1" text-color="blue-9">
                    <q-icon name="sym_o_table" size="xs" class="q-mr-xs" />
                    {{ rows.length }} Rows
                </q-badge>
                <q-badge color="blue-1" text-color="blue-9">
                    {{ columns.length }} Columns
                </q-badge>
                <div class="text-caption text-grey-7">
                    Delimiter: {{ delimiterLabel }}
                </div>
            </div>
            <div class="row items-center q-gutter-x-sm">
                <q-btn-toggle
                    v-model="mode"
                    dense
                    flat
                    no-caps
                    toggle-color="primary"
                    size="sm"
                    :options="[
                        { label: 'Table', value: 'table' },
                        { label: 'Source', value: 'source' },
                    ]"
                />
                <q-btn
                    icon="sym_o_content_copy"
                    flat
                    round
                    dense
                    size="sm"
                    color="grey-7"
                    @click="copyRaw"
                >
                    <q-tooltip>Copy Content</q-tooltip>
                </q-btn>
            </div>
        </div>

        <q-banner
            v-if="truncated"
            dense
            class="bg-orange-1 text-orange-9 q-mb-md rounded-borders"
        >
            <template #avatar>
                <q-icon name="sym_o_info" />
            </template>
            Showing the first
            {{ rows.length.toLocaleString() }} rows. Download the file to see
            all of it.
        </q-banner>

        <div v-if="mode === 'source'" class="code-block bg-grey-1 q-pa-md">
            <pre class="q-ma-none text-code">{{ content }}</pre>
        </div>
        <q-table
            v-else-if="columns.length > 0"
            flat
            bordered
            dense
            :rows="rows"
            :columns="columns"
            row-key="rowIndex"
            :pagination="{ rowsPerPage: 25 }"
            :rows-per-page-options="[25, 50, 100, 0]"
            class="csv-table"
        />
        <div v-else class="text-grey-6 text-center q-pa-lg">
            No tabular data found
        </div>
    </div>
</template>

<script setup lang="ts">
import { Notify, QTableColumn, copyToClipboard } from 'quasar';
import { computed, ref } from 'vue';

const properties = withDefaults(
    defineProps<{
        content: string;
        /** Set when `content` is only the leading slice of a larger file. */
        truncated?: boolean;
    }>(),
    { truncated: false },
);

/** Rendering more than this in the browser is slower than downloading the file. */
const MAX_PREVIEW_ROWS = 5000;

/** Characters scanned to pick the delimiter; a header plus a few rows is plenty. */
const DETECTION_SAMPLE_CHARS = 64 * 1024;
const DETECTION_SAMPLE_RECORDS = 20;

const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'] as const;
type Delimiter = (typeof CANDIDATE_DELIMITERS)[number];

const DELIMITER_LABELS = new Map<Delimiter, string>([
    [',', 'comma'],
    [';', 'semicolon'],
    ['\t', 'tab'],
    ['|', 'pipe'],
]);

const mode = ref<'table' | 'source'>('table');

/**
 * Splits CSV text into records of fields, honouring quoted fields (which may
 * contain the delimiter, newlines, and `""` escapes).
 */
const isBlankRecord = (record: string[]): boolean =>
    record.length <= 1 && (record[0] ?? '').length === 0;

interface ParseOptions {
    /** False when `text` is a prefix, so the trailing partial record is dropped. */
    complete: boolean;
    /** Stop once this many records are parsed, bounding work on huge inputs. */
    maxRecords: number;
}

function parseCsv(
    text: string,
    delimiter: string,
    options: ParseOptions,
): string[][] {
    const records: string[][] = [];
    let record: string[] = [];
    let field = '';
    let inQuotes = false;

    const endField = (): void => {
        record.push(field);
        field = '';
    };
    const endRecord = (): void => {
        endField();
        // A blank line is not a row. Dropping it here rather than after parsing
        // stops it from consuming the record budget, which would otherwise let
        // rows fall off the end without the truncation notice appearing.
        if (!isBlankRecord(record)) records.push(record);
        record = [];
    };

    for (
        let index = 0;
        index < text.length && records.length < options.maxRecords;
        index++
    ) {
        const character = text.charAt(index);

        if (inQuotes) {
            if (character === '"' && text.charAt(index + 1) === '"') {
                field += '"';
                index++;
            } else if (character === '"') {
                inQuotes = false;
            } else {
                field += character;
            }
            continue;
        }

        if (character === delimiter) {
            endField();
            continue;
        }

        switch (character) {
            case '"': {
                inQuotes = true;
                break;
            }
            case '\n': {
                endRecord();
                break;
            }
            case '\r': {
                break;
            }
            default: {
                field += character;
            }
        }
    }

    // A complete file without a trailing newline still ends on a real record;
    // a prefix almost always ends mid-row, so that fragment is discarded.
    const hasPendingRecord = field.length > 0 || record.length > 0;
    if (
        options.complete &&
        hasPendingRecord &&
        records.length < options.maxRecords
    )
        endRecord();

    return records;
}

/** Picks the delimiter that yields the most consistent field count. */
const delimiter = computed<Delimiter>(() => {
    const sample = properties.content.slice(0, DETECTION_SAMPLE_CHARS);
    // A sample that stops short of the end cuts the last row in half, which
    // would otherwise look like an inconsistent field count and reject the
    // real delimiter.
    const complete =
        !properties.truncated && sample.length === properties.content.length;

    let best: Delimiter = ',';
    let bestFields = 0;

    for (const candidate of CANDIDATE_DELIMITERS) {
        const records = parseCsv(sample, candidate, {
            complete,
            maxRecords: DETECTION_SAMPLE_RECORDS,
        });
        const first = records[0];
        if (first === undefined || first.length < 2) continue;
        if (!records.every((record) => record.length === first.length))
            continue;
        if (first.length > bestFields) {
            bestFields = first.length;
            best = candidate;
        }
    }
    return best;
});

const delimiterLabel = computed(() => DELIMITER_LABELS.get(delimiter.value));

// Parsing stops at the preview cap, so a huge CSV never materialises in full.
const records = computed(() =>
    parseCsv(properties.content, delimiter.value, {
        complete: !properties.truncated,
        maxRecords: MAX_PREVIEW_ROWS + 1,
    }),
);

const truncated = computed(
    () => properties.truncated || records.value.length > MAX_PREVIEW_ROWS,
);

const columns = computed<QTableColumn[]>(() => {
    const header = records.value[0];
    if (header === undefined) return [];
    return header.map((label, index) => ({
        name: `c${String(index)}`,
        // A blank header still needs a distinguishable column title.
        label: label.trim() === '' ? `Column ${String(index + 1)}` : label,
        field: `c${String(index)}`,
        align: 'left' as const,
        sortable: true,
    }));
});

const rows = computed(() =>
    records.value.slice(1).map((record, rowIndex) => {
        const row: Record<string, number | string> = { rowIndex };
        for (const [index, value] of record.entries())
            row[`c${String(index)}`] = value;
        return row;
    }),
);

async function copyRaw(): Promise<void> {
    await copyToClipboard(properties.content);
    Notify.create({ message: 'Content copied', color: 'positive' });
}
</script>

<style scoped>
.border-solid {
    border: 1px solid #e0e0e0;
}
.text-code {
    font-family: monospace;
    font-size: 13px;
}
.code-block {
    max-width: 100%;
    min-width: 0;
    overflow-x: auto;
    border-radius: 4px;
}
.csv-table {
    max-width: 100%;
}
.csv-table :deep(td) {
    white-space: nowrap;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
