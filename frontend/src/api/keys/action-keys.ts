import { ActionQuery } from '@api/types/submit-action.dto';
import { MaybeRef, unref } from 'vue';

export const actionKeys = {
    all: ['actions'] as const,

    lists: () => [...actionKeys.all, 'list'] as const,

    list: (filters: MaybeRef<ActionQuery>) =>
        [...actionKeys.lists(), unref(filters)] as const,

    details: () => [...actionKeys.all, 'detail'] as const,

    detail: (uuid: MaybeRef<string>) =>
        [...actionKeys.details(), unref(uuid)] as const,

    running: () => [...actionKeys.all, 'running'] as const,

    templates: {
        all: ['templates'] as const,

        lists: () => [...actionKeys.templates.all, 'list'] as const,

        list: (filters: Record<string, unknown>) =>
            [...actionKeys.templates.lists(), filters] as const,

        revisions: (uuid: MaybeRef<string>) =>
            [...actionKeys.templates.all, 'revisions', unref(uuid)] as const,

        availability: (name: MaybeRef<string>) =>
            [...actionKeys.templates.all, 'availability', unref(name)] as const,
    },
};
