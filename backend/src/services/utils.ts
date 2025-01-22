export const convertGlobToLikePattern = (glob: string) => {
    return glob
        .replaceAll('%', String.raw`\%`)
        .replaceAll('_', String.raw`\_`)
        .replaceAll('*', '%')
        .replaceAll('?', '_');
};
