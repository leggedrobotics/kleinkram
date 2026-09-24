import environment from '@backend-common/environment';
import * as fs from 'node:fs';
import { parse } from 'yaml';

/** A link shown next to the archive storage, e.g. to its service page. */
export interface ArchiveConfigLink {
    label: string;
    url: string;
}

/**
 * Deployment specific information about the archive storage, loaded from the
 * YAML file at `ARCHIVE_CONFIG_PATH`. None of it changes how data is written;
 * it tells users (and anybody who finds an archive later) what the storage is
 * and how to get the files back.
 */
export interface ArchiveConfig {
    /** Shown to users, e.g. "ETH Long Term Storage". */
    name: string;
    /** A few sentences about the storage: who runs it, how safe it is. */
    description?: string;
    /** Price per TB and year, used for the estimate before archiving. */
    costPerTbYear?: number;
    currency: string;
    links: ArchiveConfigLink[];
    /**
     * How to get the files of an archive back without Kleinkram, e.g. whom to
     * ask for access to the share and how to unpack the parts. Shown on
     * archived projects and written into every archive. Supports the
     * placeholders {projectName}, {projectUuid}, {archiveUuid}, {location}
     * and {parts}.
     */
    restoreInstructions?: string;
}

// Plain strings: the {placeholders} are filled by renderRestoreInstructions
const DEFAULT_RESTORE_INSTRUCTIONS = [
    'The files are stored in tar files at {location}.',
    '1. Copy the tar files ({parts}) to a local disk; do not open them in place.',
    '2. Unpack them with `tar -xf <part>.tar`. Each tar contains the files as',
    '   they were uploaded, at <mission>/<filename>.',
    '3. Every tar ends with a kleinkram.yml that lists the missions, their',
    '   metadata and the sha256 of every file; compare it with `sha256sum`.',
].join('\n');

const DEFAULT_CONFIG: ArchiveConfig = {
    name: 'archive storage',
    currency: 'CHF',
    links: [],
    restoreInstructions: DEFAULT_RESTORE_INSTRUCTIONS,
};

let cached: ArchiveConfig | undefined;

const optionalString = (value: unknown, key: string): string | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') {
        throw new TypeError(
            `Invalid archive config: "${key}" must be a string`,
        );
    }
    return value.trim();
};

/**
 * Parses and validates an archive config. Missing fields fall back to
 * neutral defaults so that a config only has to name what it knows.
 */
export function parseArchiveConfig(raw: string): ArchiveConfig {
    const parsed = (parse(raw) ?? {}) as Record<string, unknown>;
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new TypeError('Invalid archive config: expected a mapping');
    }

    const cost = parsed.costPerTbYear;
    if (cost !== undefined && cost !== null && typeof cost !== 'number') {
        throw new TypeError(
            'Invalid archive config: "costPerTbYear" must be a number',
        );
    }

    const links = (parsed.links ?? []) as unknown;
    if (
        !Array.isArray(links) ||
        !links.every(
            (link: unknown) =>
                typeof link === 'object' &&
                link !== null &&
                typeof (link as ArchiveConfigLink).label === 'string' &&
                typeof (link as ArchiveConfigLink).url === 'string',
        )
    ) {
        throw new TypeError(
            'Invalid archive config: "links" must be a list of { label, url }',
        );
    }

    return {
        name: optionalString(parsed.name, 'name') ?? DEFAULT_CONFIG.name,
        description: optionalString(parsed.description, 'description'),
        costPerTbYear: typeof cost === 'number' ? cost : undefined,
        currency:
            optionalString(parsed.currency, 'currency') ??
            DEFAULT_CONFIG.currency,
        links: links as ArchiveConfigLink[],
        restoreInstructions:
            optionalString(parsed.restoreInstructions, 'restoreInstructions') ??
            DEFAULT_RESTORE_INSTRUCTIONS,
    };
}

/**
 * The archive config of this deployment. Read once from
 * `ARCHIVE_CONFIG_PATH`; without it the neutral defaults apply.
 */
export function loadArchiveConfig(
    configPath: string | undefined = environment.ARCHIVE_CONFIG_PATH,
): ArchiveConfig {
    if (cached) return cached;
    if (configPath === undefined) {
        cached = DEFAULT_CONFIG;
        return cached;
    }

    let raw: string;
    try {
        raw = fs.readFileSync(configPath, 'utf8');
    } catch (error) {
        throw new Error(
            `Cannot read archive config at "${configPath}": ${String(error)}`,
        );
    }
    cached = parseArchiveConfig(raw);
    return cached;
}

export interface RestoreInstructionValues {
    projectName: string;
    projectUuid: string;
    archiveUuid: string;
    location: string;
    parts: string[];
}

/** Fills the placeholders of the configured restore instructions. */
export function renderRestoreInstructions(
    values: RestoreInstructionValues,
    config: ArchiveConfig = loadArchiveConfig(),
): string {
    const replacements: Record<string, string> = {
        projectName: values.projectName,
        projectUuid: values.projectUuid,
        archiveUuid: values.archiveUuid,
        location: values.location,
        parts: values.parts.length > 0 ? values.parts.join(', ') : 'part-*.tar',
    };
    return (
        config.restoreInstructions ?? DEFAULT_RESTORE_INSTRUCTIONS
    ).replaceAll(
        /{(\w+)}/g,
        (match, key: string) => replacements[key] ?? match,
    );
}
