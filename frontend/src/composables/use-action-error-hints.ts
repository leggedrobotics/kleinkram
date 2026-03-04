import type { ActionLogsDto } from '@kleinkram/api-dto/types/actions/action-logs.dto';
import type { ActionDto } from '@kleinkram/api-dto/types/actions/action.dto';
import { ActionErrorHint, ActionState } from '@kleinkram/shared';
import ROUTES from 'src/router/routes';
import { computed, nextTick, type Ref } from 'vue';
import type { Router } from 'vue-router';
import environment from '../environment';

export interface ErrorHint {
    id: string;
    text: string;
    buttonLabel?: string;
    check: (action: ActionDto, logs: ActionLogsDto | undefined) => boolean;
    onClick: (
        action: ActionDto,
        router: Router,
        context: {
            logs?: ActionLogsDto | undefined;
            scrollToLog?: ((index: number) => void) | undefined;
        },
    ) => void | Promise<void>;
}

const ERROR_HINTS: ErrorHint[] = [
    {
        id: 'docker-404',
        text: 'The Docker image could not be found. Please check the image name.',
        buttonLabel: 'Edit Action Settings',
        check: (act) =>
            act.errorHint === ActionErrorHint.DOCKER_IMAGE_NOT_FOUND ||
            // Fallback for actions processed before update
            (act.state === ActionState.FAILED &&
                act.stateCause.includes('failed to resolve reference') &&
                act.stateCause.includes('not found')),
        onClick: async (act, r) => {
            await r.push({
                name: ROUTES.ACTION_TEMPLATE_EDIT.routeName,
                params: { templateId: act.template.uuid },
                query: r.currentRoute.value.query,
            });
        },
    },
    {
        id: 'cli-outdated',
        text: 'This action likely failed due to an outdated Kleinkram CLI. Please rebuild it with a newer CLI version',
        buttonLabel: 'View Logs',
        check: (act, logsData) => {
            if (act.errorHint === ActionErrorHint.CLI_OUTDATED) return true;
            // Fallback
            if (!logsData?.data) return false;
            const lastLogs = logsData.data.slice(-25);
            return lastLogs.some(
                (l) =>
                    l.message.includes('Update CLIVersion') ||
                    l.message.includes('Please update your CLI') ||
                    l.message.includes(
                        'Error downloading data: Please update your CLI',
                    ),
            );
        },
        onClick: (_, _r, context) => {
            if (!context.logs?.data || !context.scrollToLog) return;

            const logsData = context.logs.data;
            const lastLogs = logsData.slice(-25);
            const startIndex = Math.max(0, logsData.length - 25);

            for (const [index, log] of lastLogs.entries()) {
                if (
                    log.message.includes('Update CLIVersion') ||
                    log.message.includes('Please update your CLI') ||
                    log.message.includes(
                        'Error downloading data: Please update your CLI',
                    )
                ) {
                    const globalIndex = startIndex + index;
                    context.scrollToLog(globalIndex);
                    break;
                }
            }
        },
    },
    {
        id: 'memory-limit-exceeded',
        text: 'The action was killed because it exceeded the memory limit. This is often caused by downloading large files to the container memory. Please try using /tmp_disk for downloads.',
        buttonLabel: 'View Documentation',
        check: (act) => act.errorHint === ActionErrorHint.MEMORY_LIMIT_EXCEEDED,
        onClick: () => {
            window.open(`${environment.DOCS_URL}/advanced/tmp_disk`, '_blank');
        },
    },
    {
        id: 'system-interruption',
        text: 'The action was interrupted by the scheduler. Please try again later or contact your administrator.',
        buttonLabel: 'View Documentation',
        check: (act) => act.stateCause === 'Interrupted by new Runner Instance',
        onClick: () => {
            window.open(
                `${environment.DOCS_URL}/usage/actions/action-status`,
                '_blank',
            );
        },
    },
];

export function useActionErrorHints(
    action: Ref<ActionDto | undefined>,
    logs: Ref<ActionLogsDto | undefined>,
    router: Router,
    context: {
        tab: Ref<string>;
        highlightedLogIndex: Ref<number | null>;
    },
) {
    const activeHints = computed(() => {
        const currentAction = action.value;
        if (!currentAction) return [];
        return ERROR_HINTS.filter((hint) =>
            hint.check(currentAction, logs.value),
        );
    });

    // Internal implementation of scrollToLog
    const scrollToLog = (index: number) => {
        void (async () => {
            context.tab.value = 'logs';
            context.highlightedLogIndex.value = index;
            await nextTick();
            const element = document.querySelector(
                `#log-line-${String(index)}`,
            );
            if (element) {
                element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }
            setTimeout(() => {
                context.highlightedLogIndex.value = null;
            }, 2000);
        })();
    };

    const executeHint = async (hint: ErrorHint) => {
        if (!action.value) return;

        await hint.onClick(action.value, router, {
            logs: logs.value,
            scrollToLog,
        });
    };

    return {
        activeHints,
        executeHint,
    };
}
