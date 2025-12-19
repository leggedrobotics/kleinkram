import { FileType } from '@kleinkram/shared';
import { useQuery } from '@tanstack/vue-query';
import {
    useAllTags,
    useFilteredProjects,
    useMissionsOfProjectMinimal,
    useProjectQuery,
} from 'src/hooks/query-hooks';
import { Filter } from 'src/services/filters/filter-interface';
import { DatatypeFilter } from 'src/services/filters/implementations/datatype-filter';
import {
    EndDateFilter,
    StartDateFilter,
} from 'src/services/filters/implementations/date-filter';
import { FileTypeFilter } from 'src/services/filters/implementations/file-type-filter';
import { MetadataFilter } from 'src/services/filters/implementations/metadata-filter';
import { MissionFilter } from 'src/services/filters/implementations/mission-filter';
import { ProjectFilter } from 'src/services/filters/implementations/project-filter';
import { TopicFilter } from 'src/services/filters/implementations/topic-filter';
import { allTopicsNames, allTopicTypes } from 'src/services/queries/topic';
import { CompositeFilterProvider } from 'src/services/suggestions/strategies/composite-filter-provider';
import { KeywordStrategy } from 'src/services/suggestions/strategies/keyword-strategy';
import {
    MetadataTag,
    SuggestionProvider,
} from 'src/services/suggestions/suggestion-types';
import { computed, Ref } from 'vue';
import { FilterState } from './use-file-filter';
import { FilterParserContext } from './use-filter-parser';

export interface FileSearchContextData extends FilterParserContext {
    projects: { name: string; uuid: string }[];
    missions: { name: string; uuid: string }[];
    topics: string[];
    datatypes: string[];
    fileTypes: string[];
    availableTags: MetadataTag[];
    hasProjectSelected: boolean;
    projectUuid?: string | undefined;
    missionUuid?: string | undefined;
    setProject?: ((uuid: string | undefined) => void) | undefined;
    setMission?: ((uuid: string | undefined) => void) | undefined;
}

export function useFileSearch(
    currentProjectUuid: Ref<string | undefined>,
    currentMissionUuid?: Ref<string | undefined>,
    setProject?: (uuid: string | undefined) => void,
    setMission?: (uuid: string | undefined) => void,
) {
    // --- Data Fetching ---

    // Projects
    const { data: projectsData } = useFilteredProjects(100, 0, 'name', false);
    const { data: selectedProject } = useProjectQuery(currentProjectUuid);

    const projects = computed(() => {
        const list =
            projectsData.value?.data.map((p) => ({
                name: p.name,
                uuid: p.uuid,
            })) ?? [];

        if (currentProjectUuid.value) {
            const p = list.find((x) => x.uuid === currentProjectUuid.value);
            if (!p) {
                list.push({
                    name:
                        selectedProject.value?.name ?? currentProjectUuid.value,
                    uuid: currentProjectUuid.value,
                });
            }
        }
        return list;
    });

    // Missions (dependent on project)
    const { data: missionsData } = useMissionsOfProjectMinimal(
        currentProjectUuid,
        100,
        0,
    );
    const missions = computed(() => {
        const list =
            missionsData.value?.data.map((m) => ({
                name: m.name,
                uuid: m.uuid,
            })) ?? [];

        if (currentMissionUuid?.value) {
            const m = list.find((x) => x.uuid === currentMissionUuid.value);
            if (!m) {
                list.push({
                    name: currentMissionUuid.value, // We don't have a mission query yet, so just use UUID
                    uuid: currentMissionUuid.value,
                });
            }
        }
        return list;
    });

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

    // FileTypes (Static)
    const allFileTypes = Object.values(FileType).filter(
        (f) => f !== FileType.ALL,
    );

    // --- Context Construction ---

    const contextData = computed<FileSearchContextData>(() => ({
        projects: projects.value,
        missions: missions.value,
        topics: allTopics.value ?? [],
        datatypes: allDatatypes.value ?? [],
        fileTypes: allFileTypes,
        availableTags:
            allTags.value?.map((t) => ({
                name: t.name,
                uuid: t.uuid,
                datatype: t.datatype,
            })) ?? [],
        hasProjectSelected: !!currentProjectUuid.value,
        projectUuid: currentProjectUuid.value,
        missionUuid: currentMissionUuid?.value,
        setProject,
        setMission,
    }));

    // --- Instantiate Filters ---
    const filters: Filter<FilterState, FileSearchContextData>[] = [
        new ProjectFilter(),
        new MissionFilter(),
        new TopicFilter(),
        new DatatypeFilter(),
        new FileTypeFilter(),
        new StartDateFilter(),
        new EndDateFilter(),
        new MetadataFilter(),
    ];

    // --- Keyword Strategy (for suggesting filter keywords like "project:", "mission:", etc.) ---
    const keywordMap: Record<string, string> = {};
    for (const f of filters) {
        // Convert key like "project:" to label like "PROJECT" for display
        keywordMap[f.label.toUpperCase()] = f.key;
    }
    // Add &topic: variant
    keywordMap.TOPIC_AND = '&topic:';

    const keywordStrategy = new KeywordStrategy<FileSearchContextData>(
        keywordMap,
        {
            // Mission requires project to be selected
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'mission:': (context) => ({
                enabled: context.data.hasProjectSelected,
                reason: 'Select a project first',
            }),
        },
    );

    // --- Provider ---
    // Combine KeywordStrategy with filter suggestions
    const provider = new CompositeFilterProvider<FileSearchContextData>([
        keywordStrategy,
        ...(filters as unknown as SuggestionProvider<FileSearchContextData>[]),
    ]);

    return {
        provider,
        filters,
        contextData,
        projects,
        missions,
        allTopics,
        allDatatypes,
        allTags,
        allFileTypes,
    };
}
