export const DOCKER_IMAGE_NAME_REGEX =
    /^[a-zA-Z0-9][a-zA-Z0-9._\-/]*(?::[a-zA-Z0-9._\-]+)?(?:@sha256:[a-fA-F0-9]{64})?$/;

export const DOCKER_IMAGE_MAX_LENGTH = 256;

export function isValidDockerImageName(imageName: string): boolean {
    if (!imageName || imageName.length > DOCKER_IMAGE_MAX_LENGTH) {
        return false;
    }
    return DOCKER_IMAGE_NAME_REGEX.test(imageName);
}

export function validateDockerImageName(imageName: string): void {
    if (!isValidDockerImageName(imageName)) {
        throw new Error(
            `Invalid Docker image name: "${imageName}". Only alphanumeric characters, dots, underscores, hyphens, and forward slashes are allowed. Tags can be specified with a colon and digest references can be specified with @sha256:.`,
        );
    }
}

// A single Docker Hub namespace: lowercase alphanumerics separated by `_` or
// `-`. No `.`, `:` or `/`, so Docker can't read it as a registry host.
const DOCKER_HUB_NAMESPACE_REGEX = /^[a-z0-9]+(?:[_-]+[a-z0-9]+)*$/;

/** Trims whitespace and trailing slashes from a configured namespace. */
export function normalizeDockerNamespace(
    namespace: string | undefined,
): string {
    return namespace?.trim().replace(/\/+$/, '') ?? '';
}

/**
 * Checks that an image belongs to the given Docker Hub namespace. The image
 * must start with `<namespace>/`, so `rslethz` does not match
 * `rslethzevil/x` or `rslethz.evil.io/x` (a different registry). An empty
 * namespace disables the check. A namespace that is not a single Docker Hub
 * namespace (e.g. `evil.io/org` or `localhost`) could point to another
 * registry, so it rejects every image.
 */
export function isImageInDockerNamespace(
    imageName: string,
    namespace: string | undefined,
): boolean {
    const normalized = normalizeDockerNamespace(namespace);
    if (!normalized) {
        return true;
    }
    if (
        !DOCKER_HUB_NAMESPACE_REGEX.test(normalized) ||
        normalized === 'localhost'
    ) {
        return false;
    }
    return imageName.startsWith(`${normalized}/`);
}
