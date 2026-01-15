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
            `Invalid Docker image name: "${imageName}". Only alphanumeric characters, dots, underscores, hyphens, and forward slashes are allowed. Tags can be specified with a colon.`,
        );
    }
}
