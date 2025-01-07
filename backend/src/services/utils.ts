export const convertGlobToLikePattern = (glob: string) => {
    return glob.replace('%', '\\%')
        .replace('_', '\\_')
        .replace('*', '%')
        .replace('?', '_')
}




