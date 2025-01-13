export const convertGlobToLikePattern = (glob: string) => {
    return glob
        .replaceAll('%', '\\%')
        .replaceAll('_', '\\_')
        .replaceAll('*', '%')
        .replaceAll('?', '_');
};
