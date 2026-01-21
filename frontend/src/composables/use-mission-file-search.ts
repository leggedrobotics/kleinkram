import { FileType } from '@kleinkram/shared';
import { useQuery } from '@tanstack/vue-query';
import { useAllTags } from 'src/hooks/query-hooks';
import { Filter } from 'src/services/filters/filter-interface';
import { CategoryFilter } from 'src/services/filters/implementations/category-filter';
import { DatatypeFilter } from 'src/services/filters/implementations/datatype-filter';
import {
    EndDateFilter,
    StartDateFilter,
} from 'src/services/filters/implementations/date-filter';
import { FileTypeFilter } from 'src/services/filters/implementations/file-type-filter';
import { FilenameFilter } from 'src/services/filters/implementations/filename-filter';
import { HealthFilter } from 'src/services/filters/implementations/health-filter';
import { TopicFilter } from 'src/services/filters/implementations/topic-filter';
import { getCategories } from 'src/services/queries/categories';
import { allTopicsNames, allTopicTypes } from 'src/services/queries/topic';
import { CompositeFilterProvider } from 'src/services/suggestions/strategies/composite-filter-provider';
import { KeywordStrategy } from 'src/services/suggestions/strategies/keyword-strategy';
import {
    MetadataTag,
    SuggestionProvider,
} from 'src/services/suggestions/suggestion-types';
import { computed, Ref } from 'vue';
import { FilterParserContext } from './use-filter-parser';
import { MissionFilterState } from './use-mission-file-filter';

import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';

export interface MissionFileSearchContextData extends FilterParserContext {
    topics: string[];
    datatypes: string[];
    fileTypes: string[];
    filenames: string[];
    availableTags: MetadataTag[];
    availableCategories: { name: string; uuid: string; description?: string }[];
    // Compatibility properties
    projects: { name: string; uuid: string }[];
    missions: { name: string; uuid: string }[];
}

export function useMissionFileSearch(
    projectUuid: Ref<string | undefined>,
    files: Ref<FileWithTopicDto[] | undefined>,
) {
    // --- Data Fetching ---

    // Topics
    const { data: allTopics } = useQuery<string[]>({
        queryKey: ['topics'],
        queryFn: allTopicsNames,
    });

    // Datatypes
    const { data: allDatatypes } = useQuery<string[]>({
        queryKey: ['topicTypes'],
        queryFn: allTopicTypes,
    });

    // Tags
    const { data: allTags } = useAllTags();

    // Categories (fetched from project)
    const { data: categoriesDto } = useQuery({
        queryKey: ['categories', projectUuid],
        queryFn: () => getCategories(projectUuid.value ?? ''),
        enabled: computed(() => !!projectUuid.value),
    });

    const availableCategories = computed(() => {
        const categories = categoriesDto.value?.data ?? [];
        return categories
            .map((c) => ({ name: c.name, uuid: c.uuid, description: c.name }))
            .toSorted((a, b) => a.name.localeCompare(b.name));
    });

    // FileTypes (Static)
    const allFileTypes = Object.values(FileType).filter(
        (f) => f !== FileType.ALL,
    );

    // Filenames
    const allFilenames = computed(() => {
        return files.value?.map((f) => f.filename) ?? [];
    });

    // --- Context Construction ---

    const contextData = computed<MissionFileSearchContextData>(() => ({
        topics: allTopics.value ?? [],
        datatypes: allDatatypes.value ?? [],
        fileTypes: allFileTypes,
        filenames: allFilenames.value,
        availableTags:
            allTags.value?.map((t) => ({
                name: t.name,
                uuid: t.uuid,
                datatype: t.datatype,
            })) ?? [],
        availableCategories: availableCategories.value,
        hasProjectSelected: true, // Always true in mission context
        projectUuid: projectUuid.value,
        // Legacy compatibility for FileSearchContextData
        projects: [],
        missions: [],
        missionUuid: undefined, // Already have mission context implicitly, but filter might check this.
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        setProject: () => {},
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        setMission: () => {},
    }));

    // --- Instantiate Filters ---
    const filters: Filter<MissionFilterState, MissionFileSearchContextData>[] =
        [
            // Filename needs to be handled? FilenameFilter handles "filename:foo".
            // Free text "foo" is handled by the parser default.
            new FilenameFilter(),
            new HealthFilter(),
            new CategoryFilter(),
            new TopicFilter() as unknown as Filter<
                MissionFilterState,
                MissionFileSearchContextData
            >,
            new DatatypeFilter() as unknown as Filter<
                MissionFilterState,
                MissionFileSearchContextData
            >,
            new FileTypeFilter() as unknown as Filter<
                MissionFilterState,
                MissionFileSearchContextData
            >,
            new StartDateFilter() as unknown as Filter<
                MissionFilterState,
                MissionFileSearchContextData
            >,
            new EndDateFilter() as unknown as Filter<
                MissionFilterState,
                MissionFileSearchContextData
            >,
        ];

    // --- Keyword Strategy (for suggesting filter keywords like "health:", "category:", etc.) ---
    const keywordMap: Record<string, string> = {};
    for (const f of filters) {
        keywordMap[f.label.toUpperCase()] = f.key;
    }

    // Add &topic: variant
    keywordMap.TOPIC_AND = '&topic:';

    const keywordStrategy = new KeywordStrategy<MissionFileSearchContextData>(
        keywordMap,
        {},
    );

    // --- Provider ---
    const provider = new CompositeFilterProvider<MissionFileSearchContextData>([
        keywordStrategy,
        ...(filters as unknown as SuggestionProvider<MissionFileSearchContextData>[]),
    ]);

    return {
        provider,
        filters,
        contextData,
        allTopics,
        allDatatypes,
        allTags,
        allFileTypes,
        availableCategories,
    };
}
