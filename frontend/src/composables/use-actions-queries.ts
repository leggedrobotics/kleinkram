import { ActionTemplatesDto } from '@api/types/actions/action-templates.dto';
import { ActionDto } from '@api/types/actions/action.dto';
import { ActionsDto } from '@api/types/actions/actions.dto';
import { ActionQuery } from '@api/types/submit-action.dto';
import { ActionState } from '@common/enum';
import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
import { actionKeys } from 'src/api/keys/action-keys';
import { ActionService } from 'src/api/services/action.service';
import { computed, ComputedRef, MaybeRef, unref } from 'vue';

export function useActionDetails(
    uuid: MaybeRef<string>,
): UseQueryReturnType<ActionDto, Error> {
    return useQuery({
        queryKey: computed(() => actionKeys.detail(uuid)),
        queryFn: ({ queryKey }) => {
            const _uuid = queryKey[2];
            return ActionService.getOne(_uuid);
        },
        enabled: computed(() => !!unref(uuid)),
        refetchInterval: 5000,
    });
}

export function useActionList(
    filters: MaybeRef<ActionQuery> | ComputedRef<ActionQuery>,
): UseQueryReturnType<ActionsDto, Error> {
    return useQuery({
        queryKey: computed(() => actionKeys.list(unref(filters))),
        queryFn: ({ queryKey }) => {
            const _filters = queryKey[2];
            return ActionService.getAll(_filters as ActionQuery);
        },
    });
}

export function useTemplateRevisions(
    uuid: MaybeRef<string>,
): UseQueryReturnType<ActionTemplatesDto, Error> {
    return useQuery({
        queryKey: computed(() => actionKeys.templates.revisions(uuid)),
        queryFn: () => ActionService.getTemplateRevisions(unref(uuid)),
        enabled: computed(() => !!unref(uuid)),
    });
}

export function useTemplateList(
    parameters: MaybeRef<{ search?: string; includeArchived?: boolean }>,
): UseQueryReturnType<ActionTemplatesDto, Error> {
    return useQuery({
        queryKey: computed(() => actionKeys.templates.list(unref(parameters))),
        queryFn: () => {
            const p = unref(parameters);
            return ActionService.listTemplates(p.search, p.includeArchived);
        },
    });
}

export function useRunningActions(): UseQueryReturnType<ActionsDto, Error> {
    const filters = computed<ActionQuery>(() => ({
        skip: 0,
        take: 10,
        states: [ActionState.PROCESSING],
    }));

    const { data, refetch, isLoading, error, isFetched } =
        useActionList(filters);

    // We need to return the same structure as useQuery
    return {
        data,
        refetch,
        isLoading,
        error,
        isFetched,
    } as UseQueryReturnType<ActionsDto, Error>;
}
