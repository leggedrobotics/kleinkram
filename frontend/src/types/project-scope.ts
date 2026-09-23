/**
 * Which slice of the project list the explorer page shows.
 *
 * - `all`: every project the user has access to
 * - `mine`: projects the user created
 * - `starred`: projects the user marked as a favorite
 * - `public`: projects every user can read
 */
export type ProjectScope = 'all' | 'mine' | 'starred' | 'public';

export const PROJECT_SCOPE_LABELS: Record<ProjectScope, string> = {
    all: 'All Projects',
    mine: 'My Projects',
    starred: 'Starred Projects',
    public: 'Public Projects',
};

export const PROJECT_SCOPES: ProjectScope[] = [
    'all',
    'mine',
    'starred',
    'public',
];

/**
 * The scope named by the `scope` query parameter, so that a link can open the
 * project list on a given slice (the dashboard's starred panel links to
 * `?scope=starred`). Unknown or missing values fall back to `all`.
 */
export const parseProjectScope = (value: unknown): ProjectScope =>
    PROJECT_SCOPES.find((scope) => scope === value) ?? 'all';
