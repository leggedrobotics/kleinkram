<template>
    <div v-if="diagnostics.length > 0 || truncated">
        <div class="text-h6 q-mb-sm">
            What this action reported
            <span class="text-caption text-grey-6 q-ml-sm">
                ({{ summary }})
            </span>
        </div>

        <q-list bordered separator class="rounded-borders">
            <q-item v-for="group in groups" :key="group.key">
                <q-item-section avatar>
                    <q-icon
                        :name="iconFor(group.severity)"
                        :color="colorFor(group.severity)"
                    />
                </q-item-section>
                <q-item-section>
                    <q-item-label>{{ group.message }}</q-item-label>
                    <q-item-label caption>
                        <span v-if="group.code" class="q-mr-sm">
                            {{ group.code }}
                        </span>
                        <span v-if="group.files.length > 0">
                            {{ group.files.join(', ') }}
                        </span>
                    </q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-badge
                        v-if="group.count > 1"
                        :color="colorFor(group.severity)"
                        :label="`${group.count}×`"
                    />
                </q-item-section>
            </q-item>
        </q-list>

        <div v-if="truncated" class="text-caption text-grey-7 q-mt-sm">
            This action reported more findings than Kleinkram keeps; the list
            above is incomplete.
        </div>
    </div>
</template>

<script setup lang="ts">
import { DiagnosticSeverity } from '@kleinkram/shared';
import { computed } from 'vue';

import type { ActionDiagnosticDto } from '@kleinkram/api-dto/types/actions/action-diagnostic.dto';

const properties = defineProps<{
    diagnostics: ActionDiagnosticDto[];
    truncated: boolean;
}>();

interface DiagnosticGroup {
    key: string;
    severity: DiagnosticSeverity;
    message: string;
    code: string | undefined;
    files: string[];
    count: number;
}

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = {
    [DiagnosticSeverity.ERROR]: 0,
    [DiagnosticSeverity.WARNING]: 1,
    [DiagnosticSeverity.INFO]: 2,
};

/**
 * Findings that share a message are the same finding seen on different files,
 * so they read better as one row listing the files than as a wall of near
 * identical lines.
 */
const groups = computed<DiagnosticGroup[]>(() => {
    const byMessage = new Map<string, DiagnosticGroup>();

    for (const diagnostic of properties.diagnostics) {
        const key = `${diagnostic.severity}|${diagnostic.code ?? ''}|${diagnostic.message}`;
        const existing = byMessage.get(key);

        if (existing) {
            existing.count += diagnostic.count;
            if (diagnostic.file) existing.files.push(diagnostic.file);
        } else {
            byMessage.set(key, {
                key,
                severity: diagnostic.severity,
                message: diagnostic.message,
                code: diagnostic.code,
                files: diagnostic.file ? [diagnostic.file] : [],
                count: diagnostic.count,
            });
        }
    }

    return [...byMessage.values()].sort(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    );
});

const summary = computed(() => {
    const counts = { warnings: 0, errors: 0, notes: 0 };
    for (const diagnostic of properties.diagnostics) {
        if (diagnostic.severity === DiagnosticSeverity.ERROR)
            counts.errors += diagnostic.count;
        else if (diagnostic.severity === DiagnosticSeverity.WARNING)
            counts.warnings += diagnostic.count;
        else counts.notes += diagnostic.count;
    }

    const parts: string[] = [];
    if (counts.errors > 0) parts.push(`${counts.errors.toString()} errors`);
    if (counts.warnings > 0)
        parts.push(`${counts.warnings.toString()} warnings`);
    if (counts.notes > 0) parts.push(`${counts.notes.toString()} notes`);
    return parts.join(', ');
});

const colorFor = (severity: DiagnosticSeverity): string => {
    switch (severity) {
        case DiagnosticSeverity.ERROR: {
            return 'red';
        }
        case DiagnosticSeverity.WARNING: {
            return 'amber-8';
        }
        case DiagnosticSeverity.INFO: {
            return 'grey-7';
        }
    }
};

const iconFor = (severity: DiagnosticSeverity): string => {
    switch (severity) {
        case DiagnosticSeverity.ERROR: {
            return 'sym_o_error';
        }
        case DiagnosticSeverity.WARNING: {
            return 'sym_o_warning';
        }
        case DiagnosticSeverity.INFO: {
            return 'sym_o_info';
        }
    }
};
</script>
<style scoped></style>
