import {
    parseSearchString,
    validateSearchSyntax,
} from 'src/services/suggestions/search-parser';
import { computed, Ref } from 'vue';
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
};

interface NamedItem {
    name: string;
    uuid: string;
}

interface ParsedFilter {
    projectUuid?: string;
    missionUuid?: string;
    topics: string[];
    matchAllTopics: boolean;
    datatypes: string[];
    fileTypes: Set<string>;
    metadata: Record<string, { name: string; value: string }>;
    startDate?: string;
    endDate?: string;
    freeText: string;
}

const quote = (s: string) => (s.includes(' ') ? `"${s}"` : s);

export function useFilterParser(
    state: FilterState,
    setFilterString: (filterString_: string) => void,
    options: {
        projects: Ref<NamedItem[]>;
        missions: Ref<NamedItem[]>;
        projectUuid: Ref<string | undefined>;
        missionUuid: Ref<string | undefined>;
        setProject: (uuid: string | undefined) => void;
        setMission: (uuid: string | undefined) => void;
        defaultStartDate?: string;
        defaultEndDate?: string;
    },
) {
    const filterString = computed(() => {
        const parts: string[] = [];

        if (options.projectUuid.value) {
            const p = options.projects.value.find(
                (x) => x.uuid === options.projectUuid.value,
            );
            if (p) parts.push(`${KEYWORDS.PROJECT}${quote(p.name)}`);
        }
        if (options.missionUuid.value) {
            const m = options.missions.value.find(
                (x) => x.uuid === options.missionUuid.value,
            );
            if (m) parts.push(`${KEYWORDS.MISSION}${quote(m.name)}`);
        }

        const topicKeyword = state.matchAllTopics
            ? KEYWORDS.TOPIC_AND
            : KEYWORDS.TOPIC;
        for (const t of state.selectedTopics)
            parts.push(`${topicKeyword}${quote(t)}`);
        for (const d of state.selectedDatatypes)
            parts.push(`${KEYWORDS.DATATYPE}${quote(d)}`);

        if (state.fileTypeFilter) {
            const allSelected = state.fileTypeFilter.every((ft) => ft.value);
            if (!allSelected) {
                for (const ft of state.fileTypeFilter) {
                    if (ft.value)
                        parts.push(`${KEYWORDS.FILETYPE}${quote(ft.name)}`);
                }
            }
        }

        for (const tag of Object.values(state.tagFilter)) {
            parts.push(
                `${KEYWORDS.METADATA}${quote(`${tag.name}=${tag.value}`)}`,
            );
        }

        // Add date filters if set (skip if "All" - epoch date 01.01.1970)
        const startDateOnly = state.startDates.split(' ')[0];
        const isAllDates = startDateOnly === '01.01.1970';

        if (!isAllDates && state.startDates && startDateOnly)
            parts.push(`${KEYWORDS.START}${startDateOnly}`);
        if (!isAllDates && state.endDates) {
            const dateOnly = state.endDates.split(' ')[0];
            if (dateOnly) parts.push(`${KEYWORDS.END}${dateOnly}`);
        }

        if (state.filter) {
            parts.push(state.filter);
        }

        return parts.join(' ');
    });

    // eslint-disable-next-line complexity
    function parseTokens(input: string): ParsedFilter {
        const result: ParsedFilter = {
            topics: [],
            matchAllTopics: false,
            datatypes: [],
            fileTypes: new Set(),
            metadata: {},
            freeText: '',
        };

        const parsed = parseSearchString(input);
        result.freeText = parsed.freeText;

        // Check if there was matchForAll in tokens
        let hasAndTopic = false;

        for (const token of parsed.tokens) {
            if (!token.key) continue;

            const keyWithColon = token.key + ':';

            let handled = true;

            switch (keyWithColon) {
                case KEYWORDS.PROJECT: {
                    if (token.value) {
                        if (options.projects.value.length === 0) {
                            // Projects not loaded yet, preserve current if set
                            if (options.projectUuid.value) {
                                result.projectUuid = options.projectUuid.value;
                            }
                        } else {
                            const project = options.projects.value.find(
                                (p) =>
                                    p.name.toLowerCase() ===
                                        token.value.toLowerCase() ||
                                    p.uuid === token.value,
                            );
                            if (project) result.projectUuid = project.uuid;
                        }
                    }
                    break;
                }
                case KEYWORDS.MISSION: {
                    if (token.value) {
                        if (options.missions.value.length === 0) {
                            if (options.missionUuid.value) {
                                result.missionUuid = options.missionUuid.value;
                            }
                        } else {
                            const mission = options.missions.value.find(
                                (m) =>
                                    m.name.toLowerCase() ===
                                        token.value.toLowerCase() ||
                                    m.uuid === token.value,
                            );
                            if (mission) result.missionUuid = mission.uuid;
                        }
                    }
                    break;
                }
                case KEYWORDS.TOPIC: {
                    if (token.value) result.topics.push(token.value);
                    break;
                }
                case KEYWORDS.TOPIC_AND: {
                    if (token.value) {
                        result.topics.push(token.value);
                        hasAndTopic = true;
                    }
                    break;
                }
                case KEYWORDS.DATATYPE: {
                    if (token.value) result.datatypes.push(token.value);
                    break;
                }
                case KEYWORDS.FILETYPE: {
                    if (token.value)
                        result.fileTypes.add(token.value.toLowerCase());
                    break;
                }
                case KEYWORDS.METADATA: {
                    if (token.value.includes('=')) {
                        const [mKey, mValue] = token.value.split('=');
                        if (mKey && mValue) {
                            result.metadata[mKey] = {
                                name: mKey,
                                value: mValue,
                            };
                        }
                    }
                    break;
                }
                case KEYWORDS.START:
                case KEYWORDS.END: {
                    break;
                }
                default: {
                    handled = false;
                }
            }

            if (!handled) {
                result.freeText +=
                    (result.freeText ? ' ' : '') + token.original;
            }
        }

        result.matchAllTopics = hasAndTopic;
        return result;
    }

    function parse(input: string) {
        const parsed = parseTokens(input);

        options.setProject(parsed.projectUuid);
        options.setMission(parsed.missionUuid);

        state.selectedTopics = parsed.topics;
        state.matchAllTopics = parsed.matchAllTopics;
        state.selectedDatatypes = parsed.datatypes;

        if (state.fileTypeFilter) {
            const implicitlyAll = parsed.fileTypes.size === 0;

            for (const ft of state.fileTypeFilter) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (ft) {
                    ft.value = implicitlyAll
                        ? true
                        : parsed.fileTypes.has(ft.name.toLowerCase());
                }
            }
        }

        state.tagFilter = parsed.metadata;

        // Date Parsing
        if (options.defaultStartDate) {
            // Append 00:00 if parser extracted just date
            const startValue = parsed.startDate
                ? `${parsed.startDate} 00:00`
                : options.defaultStartDate;
            // Check if user typed full time? Assuming they type DD.MM.YYYY (split by space [0] used in reconstruction)
            // If user typed '01.01.2023', we make it '01.01.2023 00:00'.
            state.startDates = startValue;
        }
        if (options.defaultEndDate) {
            const endValue = parsed.endDate
                ? `${parsed.endDate} 23:59`
                : options.defaultEndDate;
            state.endDates = endValue;
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        state.filter = (parsed.freeText.trim() ?? '').replaceAll(/\s+/g, ' ');
    }

    function validateSyntax(input: string): string | null {
        const validKeys = Object.values(KEYWORDS).map((k) =>
            k.replace(':', ''),
        );
        const error = validateSearchSyntax(input, validKeys);
        if (error) return error;

        // Check for invalid use of & prefix (only allowed for topic:)
        // The generic validator doesn't check specific key rules.
        const invalidAndPrefixRegex =
            /&(project|mission|datatype|filetype|date-start|date-end|meta):/gi;
        const invalidMatch = invalidAndPrefixRegex.exec(input);
        if (invalidMatch) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            return `The & prefix is only valid for topics (use &topic: for AND matching). Invalid: &${invalidMatch[1]}:`;
        }

        // Check Mission Dependency
        if (input.includes(KEYWORDS.MISSION) && !options.projectUuid.value) {
            return 'Cannot filter for mission without project filter.';
        }

        return null;
    }

    return {
        filterString,
        parse,
        validateSyntax,
    };
}
