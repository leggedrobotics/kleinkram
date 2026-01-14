import type { ActionLogsDto } from '@kleinkram/api-dto/types/actions/action-logs.dto';
import type { ActionDto } from '@kleinkram/api-dto/types/actions/action.dto';
import { ActionState } from '@kleinkram/shared';
import ROUTES from 'src/router/routes';
import { computed, nextTick, type Ref } from 'vue';
import type { Router } from 'vue-router';

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
        check: (act) => {
            if (act.state !== ActionState.FAILED || !act.stateCause)
                return false;
            return (
                act.stateCause.includes('failed to resolve reference') &&
                act.stateCause.includes('not found')
            );
        },
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
        check: (_, logsData) => {
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
        onClick: (_, __, context) => {
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
