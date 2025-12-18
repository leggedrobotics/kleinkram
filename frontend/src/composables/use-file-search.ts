import { FileType } from '@kleinkram/shared';
import { useQuery } from '@tanstack/vue-query';
import { KEYWORDS } from 'src/composables/use-filter-parser';
import {
    useAllTags,
    useFilteredProjects,
    useMissionsOfProjectMinimal,
    useProjectQuery,
} from 'src/hooks/query-hooks';
import { allTopicsNames, allTopicTypes } from 'src/services/queries/topic';
import {
    CompositeFilterProvider,
    GenericMetadataStrategy,
    KeywordStrategy,
    MetadataTag,
    ValueStrategy,
} from 'src/services/suggestions/filter-strategies';
import { computed, Ref } from 'vue';

export interface FileSearchContextData {
    projects: { name: string; uuid: string }[];
    missions: { name: string; uuid: string }[];
    topics: string[];
    datatypes: string[];
    fileTypes: string[];
    availableTags: MetadataTag[];
    hasProjectSelected: boolean;
}

export function useFileSearch(currentProjectUuid: Ref<string | undefined>) {
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

        if (
            selectedProject.value &&
            !list.some((p) => p.uuid === selectedProject.value.uuid)
        ) {
            list.push({
                name: selectedProject.value.name,
                uuid: selectedProject.value.uuid,
            });
        }
        return list;
    });

    // Missions (dependent on project)
    // Note: This relies on currentProjectUuid being reactive
    const { data: missionsData } = useMissionsOfProjectMinimal(
        currentProjectUuid,
        100,
        0,
    );
    const missions = computed(
        () =>
            missionsData.value?.data.map((m) => ({
                name: m.name,
                uuid: m.uuid,
            })) ?? [],
    );

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
                datatype: t.datatype,
            })) ?? [],
        hasProjectSelected: !!currentProjectUuid.value,
    }));

    // --- Strategies ---

    const provider = new CompositeFilterProvider<FileSearchContextData>([
        new KeywordStrategy<FileSearchContextData>(KEYWORDS, {
            [KEYWORDS.MISSION]: (context) => ({
                enabled: context.data.hasProjectSelected,
                reason: 'Select a project first',
            }),
            [KEYWORDS.TOPIC]: (context) => ({
                enabled: true,
                hidden: context.input.includes(KEYWORDS.TOPIC_AND),
            }),
            [KEYWORDS.TOPIC_AND]: (context) => ({
                enabled: true,
                hidden: /(?:^|\s)topic:/.test(context.input),
            }),
        }),
        new ValueStrategy<FileSearchContextData>(
            KEYWORDS.PROJECT,
            'sym_o_folder',
            'Project',
            (context) => context.data.projects,
        ),
        new ValueStrategy<FileSearchContextData>(
            KEYWORDS.MISSION,
            'sym_o_flag',
            'Mission',
            (context) => context.data.missions,
            (context) => context.data.hasProjectSelected,
        ),
        new ValueStrategy<FileSearchContextData>(
            KEYWORDS.TOPIC,
            'sym_o_topic',
            'Topic',
            (context) => context.data.topics.map((t) => ({ name: t })),
        ),
        new ValueStrategy<FileSearchContextData>(
            KEYWORDS.DATATYPE,
            'sym_o_data_object',
            'Datatype',
            (context) => context.data.datatypes.map((d) => ({ name: d })),
        ),
        new ValueStrategy<FileSearchContextData>(
            KEYWORDS.FILETYPE,
            'sym_o_description',
            'File Type',
            (context) => context.data.fileTypes.map((f) => ({ name: f })),
        ),
        new GenericMetadataStrategy<FileSearchContextData>(
            KEYWORDS.METADATA,
            (context) => context.data.availableTags,
        ),
    ]);

    return {
        provider,
        contextData,
        // Expose raw data for usage in parser/other components if needed
        projects,
        missions,
        allTopics,
        allDatatypes,
        allTags,
        allFileTypes,
    };
}
