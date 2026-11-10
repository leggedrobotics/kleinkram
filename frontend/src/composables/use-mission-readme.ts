import type { FileDto } from '@kleinkram/api-dto/types/file/file.dto';
import { FileState, FileType } from '@kleinkram/shared';
import { useQuery } from '@tanstack/vue-query';
import { downloadFile, fetchFilteredFiles } from 'src/services/queries/file';
import { fetchTextPreview, TextPreview } from 'src/services/text-preview';
import { computed, Ref } from 'vue';

const README_PATTERN = /^readme\.md$/i;

/**
 * Picks the mission's readme from the files whose name contains "readme".
 * The backend filter is a substring match, so `old-readme.md` comes back
 * too and is dropped here. With several casings present, `README.md` wins.
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
            const files = await fetchFilteredFiles({
                missionUUID: missionUuid.value ?? '',
                filename: 'readme',
                fileTypes: [FileType.MD],
                includeStates: [FileState.OK],
                take: 50,
            });
            // `null` rather than `undefined`: vue-query rejects undefined data.
            return pickReadme(files.data) ?? null;
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
