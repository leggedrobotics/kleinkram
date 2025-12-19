import { Filter } from 'src/services/filters/filter-interface';
import {
    parseSearchString,
    validateSearchSyntax,
} from 'src/services/suggestions/search-parser';
import { computed } from 'vue';
import { FilterState } from './use-file-filter';

export const KEYWORDS = {
    PROJECT: 'project:',
    MISSION: 'mission:',
    TOPIC: 'topic:',
    TOPIC_AND: '&topic:',
    DATATYPE: 'datatype:',
    FILETYPE: 'filetype:',
    START: 'date-start:',
    END: 'date-end:',
    METADATA: 'meta:',
    HEALTH: 'health:',
    CATEGORY: 'category:',
};

function quote(s: string) {
    return s.includes(' ') ? `"${s}"` : s;
}

export interface FilterParserContext {
    projects: { name: string; uuid: string }[];
    missions: { name: string; uuid: string }[];
    projectUuid?: string | undefined;
    missionUuid?: string | undefined;
    setProject?: ((uuid: string | undefined) => void) | undefined;
    setMission?: ((uuid: string | undefined) => void) | undefined;
    [key: string]: unknown;
}

export function useFilterParser<TContext extends FilterParserContext>(
    state: FilterState,
    filters: Filter<FilterState, TContext>[],
    contextAccessor: () => TContext,
    defaults?: {
        defaultStartDate?: string;
        defaultEndDate?: string;
    },
) {
    // Generate filter string from State
    const filterString = computed(() => {
        const parts: string[] = [];
        const keys = new Set(filters.map((f) => f.key));
        const context = contextAccessor();

        if (keys.has(KEYWORDS.PROJECT) && context.projectUuid) {
            const p = context.projects.find(
                (x) => x.uuid === context.projectUuid,
            );
            if (p) parts.push(`${KEYWORDS.PROJECT}${quote(p.name)}`);
        }
        if (keys.has(KEYWORDS.MISSION) && context.missionUuid) {
            const m = context.missions.find(
                (x) => x.uuid === context.missionUuid,
            );
            if (m) parts.push(`${KEYWORDS.MISSION}${quote(m.name)}`);
        }
        if (keys.has(KEYWORDS.TOPIC) || keys.has(KEYWORDS.TOPIC_AND)) {
            const topicKeyword = state.matchAllTopics
                ? KEYWORDS.TOPIC_AND
                : KEYWORDS.TOPIC;
            for (const t of state.selectedTopics)
                parts.push(`${topicKeyword}${quote(t)}`);
        }

        if (keys.has(KEYWORDS.DATATYPE)) {
            for (const d of state.selectedDatatypes)
                parts.push(`${KEYWORDS.DATATYPE}${quote(d)}`);
        }

        if (keys.has(KEYWORDS.FILETYPE) && state.fileTypeFilter) {
            const allSelected = state.fileTypeFilter.every((ft) => ft.value);
            if (!allSelected) {
                for (const ft of state.fileTypeFilter) {
                    if (ft.value)
                        parts.push(`${KEYWORDS.FILETYPE}${quote(ft.name)}`);
                }
            }
        }

        if (keys.has(KEYWORDS.METADATA)) {
            for (const tag of Object.values(state.tagFilter)) {
                parts.push(
                    `${KEYWORDS.METADATA}${quote(`${tag.name}=${tag.value}`)}`,
                );
            }
        }

        if (keys.has(KEYWORDS.HEALTH) && state.health) {
            parts.push(`${KEYWORDS.HEALTH}${state.health}`);
        }

        if (
            keys.has(KEYWORDS.CATEGORY) &&
            'categories' in state &&
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            Array.isArray((state as any).categories)
        ) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            const cats = (state as any).categories as string[];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            const availableCats = (context as any).availableCategories as
                | {
                      name: string;
                      uuid: string;
                  }[]
                | undefined;

            if (availableCats) {
                for (const catUuid of cats) {
                    const cat = availableCats.find((c) => c.uuid === catUuid);
                    if (cat) {
                        parts.push(`${KEYWORDS.CATEGORY}${quote(cat.name)}`);
                    }
                }
            }
        }

        // Dates
        if (keys.has(KEYWORDS.START)) {
            const startDateOnly = state.startDates.split(' ')[0];
            const isAllDates = startDateOnly === '01.01.1970';
            if (!isAllDates && state.startDates && startDateOnly)
                parts.push(`${KEYWORDS.START}${startDateOnly}`);
        }

        if (keys.has(KEYWORDS.END)) {
            const startDateOnly = state.startDates.split(' ')[0];
            const isAllDates = startDateOnly === '01.01.1970';
            if (!isAllDates && state.endDates) {
                const dateOnly = state.endDates.split(' ')[0];
                if (dateOnly) parts.push(`${KEYWORDS.END}${dateOnly}`);
            }
        }

        if (state.filter) {
            parts.push(state.filter);
        }

        return parts.join(' ');
    });

    // eslint-disable-next-line complexity
    function parse(input: string) {
        const parsedContext = contextAccessor();

        // Reset State
        state.selectedTopics = [];
        state.selectedDatatypes = [];
        state.tagFilter = {};
        state.tagFilter = {};
        state.filter = '';
        state.health = undefined;
        if (defaults?.defaultStartDate)
            state.startDates = defaults.defaultStartDate;
        if (defaults?.defaultEndDate) state.endDates = defaults.defaultEndDate;

        if ('categories' in state) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            (state as any).categories = [];
        }

        // Tokenize
        const { tokens, freeText } = parseSearchString(input);

        // FileType logic
        const fileTypeKey = KEYWORDS.FILETYPE.replace(':', '');
        const hasFileTypeToken = tokens.some((t) => t.key === fileTypeKey);
        if (hasFileTypeToken && state.fileTypeFilter) {
            for (const ft of state.fileTypeFilter) ft.value = false;
        } else if (state.fileTypeFilter) {
            for (const ft of state.fileTypeFilter) ft.value = true;
        }

        let hasAndTopic = false;

        // Iterate Tokens
        for (const token of tokens) {
            if (!token.key) continue;
            const fullKey = token.key + ':';

            // Handle &topic: specially
            if (fullKey === KEYWORDS.TOPIC_AND) {
                const topicFilter = filters.find(
                    (f) => f.key === KEYWORDS.TOPIC,
                );
                if (topicFilter) {
                    topicFilter.parse(token.value, state, parsedContext);
                    hasAndTopic = true;
                }
                continue;
            }

            const filter = filters.find((f) => f.key === fullKey);

            if (filter) {
                filter.parse(token.value, state, parsedContext);
            }
        }

        state.matchAllTopics = hasAndTopic;

        // Check if project/mission were in the input. If not, clear them from context.
        const hasProjectToken = tokens.some((t) => t.key === 'project');
        const hasMissionToken = tokens.some((t) => t.key === 'mission');

        if (!hasProjectToken && parsedContext.setProject) {
            parsedContext.setProject(undefined);
        }
        if (!hasMissionToken && parsedContext.setMission) {
            parsedContext.setMission(undefined);
        }

        // Collect unknown tokens
        let extraFreeText = '';
        for (const token of tokens) {
            if (!token.key) continue;
            const fullKey = token.key + ':';
            const filter = filters.find(
                (f) =>
                    f.key === fullKey ||
                    (fullKey === KEYWORDS.TOPIC_AND &&
                        f.key === KEYWORDS.TOPIC),
            );
            if (!filter) {
                extraFreeText += (extraFreeText ? ' ' : '') + token.original;
            }
        }

        const combinedFreeText = (
            freeText + (extraFreeText ? ' ' + extraFreeText : '')
        )
            .trim()
            .replaceAll(/\s+/g, ' ');

        state.filter = (state.filter + ' ' + combinedFreeText).trim();
    }

    function validateSyntax(input: string): string | null {
        const validKeys = filters.flatMap((f) => {
            const k = f.key.replace(':', '');
            if (f.key === KEYWORDS.TOPIC) return [k, '&topic'];
            return [k];
        });

        const error = validateSearchSyntax(input, validKeys);
        if (error) return error;

        // Check for invalid & prefix
        const invalidAndPrefixRegex =
            /&(project|mission|datatype|filetype|date-start|date-end|meta):/gi;
        const invalidMatch = invalidAndPrefixRegex.exec(input);
        if (invalidMatch) {
            return `The & prefix is only valid for topics (use &topic: for AND matching). Invalid: &${invalidMatch[1] ?? ''}:`;
        }

        // Mission dependency check
        const hasMission = input.toLowerCase().includes('mission:');
        if (hasMission) {
            const context = contextAccessor();
            const hasProject = input.toLowerCase().includes('project:');
            if (!context.projectUuid && !hasProject) {
                return 'Cannot filter for mission without project filter.';
            }
        }

        return null;
    }

    return {
        filterString,
        parse,
        validateSyntax,
    };
}
