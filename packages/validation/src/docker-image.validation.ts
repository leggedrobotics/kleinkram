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

/**
 * Checks that an image belongs to the given Docker Hub namespace. The image
 * must start with `<namespace>/`, so `rslethz` does not match
 * `rslethzevil/x` or `rslethz.evil.io/x` (a different registry). An empty
 * namespace disables the check.
 */
export function isImageInDockerNamespace(
    imageName: string,
    namespace: string | undefined,
): boolean {
    const normalized = namespace?.trim().replace(/\/+$/, '');
    if (!normalized) {
        return true;
    }
    return imageName.startsWith(`${normalized}/`);
}
