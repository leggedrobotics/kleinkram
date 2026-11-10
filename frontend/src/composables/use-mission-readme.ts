import type { FileDto } from '@kleinkram/api-dto/types/file/file.dto';
import { FileState, FileType } from '@kleinkram/shared';
import { useQuery } from '@tanstack/vue-query';
import { downloadFile, fetchFilteredFiles } from 'src/services/queries/file';
import { fetchTextPreview, TextPreview } from 'src/services/text-preview';
import { computed, Ref } from 'vue';

const README_PATTERN = /^readme\.md$/i;

/**
 * Picks the mission's readme from the lookup's candidates, keeping only an
 * exact `readme.md` name in any casing. With several casings present,
 * `README.md` wins.
 */
export function pickReadme(files: FileDto[]): FileDto | undefined {
    const candidates = files.filter((file) =>
        README_PATTERN.test(file.filename),
    );
    return (
        candidates.find((file) => file.filename === 'README.md') ??
        candidates.toSorted((a, b) => a.filename.localeCompare(b.filename))[0]
    );
}

const PAGE_SIZE = 100;

/**
 * Every OK markdown file whose name contains "readme.md". The filter is a
 * substring match, so names like `old-readme.md` come back too. All pages
 * are read: stopping early could leave the real README.md out of the
 * candidates.
 */
async function fetchReadmeCandidates(missionUuid: string): Promise<FileDto[]> {
    const candidates: FileDto[] = [];
    let total = 0;
    let lastPageSize = 0;
    do {
        const page = await fetchFilteredFiles({
            missionUUID: missionUuid,
            filename: 'readme.md',
            fileTypes: [FileType.MD],
            includeStates: [FileState.OK],
            take: PAGE_SIZE,
            skip: candidates.length,
            // A fixed order keeps pages from overlapping or skipping files.
            sort: 'filename',
            desc: false,
        });
        candidates.push(...page.data);
        total = page.count;
        lastPageSize = page.data.length;
    } while (lastPageSize === PAGE_SIZE && candidates.length < total);
    return candidates;
}

/**
 * Finds the README.md (any casing) at the top of a mission and loads its
 * content for the Mission Info tab.
 */
export function useMissionReadme(missionUuid: Ref<string | undefined>) {
    const readmeQuery = useQuery({
        // Under the mission's `files` key, so uploads, deletes and moves that
        // invalidate the file list re-check for a readme as well.
        queryKey: computed(() => ['files', missionUuid.value, 'readme']),
        queryFn: async () => {
            const files = await fetchReadmeCandidates(missionUuid.value ?? '');
            // `null` rather than `undefined`: vue-query rejects undefined data.
            return pickReadme(files) ?? null;
        },
        enabled: computed(() => !!missionUuid.value),
    });

    const readme = computed(() => readmeQuery.data.value ?? undefined);

    const contentQuery = useQuery({
        // The hash changes when the file is replaced, so a new upload is
        // never served from the cache of the old one.
        queryKey: computed(() => [
            'files',
            'readmeContent',
            readme.value?.uuid,
            readme.value?.hash,
        ]),
        queryFn: async (): Promise<TextPreview> => {
            const uuid = readme.value?.uuid ?? '';
            const url = await downloadFile(uuid, false, true);
            const preview = await fetchTextPreview(url);
            if (!preview) throw new Error('Could not load the readme');
            return preview;
        },
        enabled: computed(() => !!readme.value),
    });

    return {
        readme,
        /** True until we know whether the mission has a readme. */
        isLookupPending: computed(
            () => !!missionUuid.value && readmeQuery.isPending.value,
        ),
        content: computed(() => contentQuery.data.value),
        isContentLoading: contentQuery.isLoading,
        contentError: contentQuery.error,
    };
}
