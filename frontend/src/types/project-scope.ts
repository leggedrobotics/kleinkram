/**
 * Which slice of the project list the explorer page shows.
 *
 * - `all`: every project the user has access to
 * - `mine`: projects the user created
 * - `starred`: projects the user marked as a favorite
 */
export type ProjectScope = 'all' | 'mine' | 'starred';

export const PROJECT_SCOPE_LABELS: Record<ProjectScope, string> = {
    all: 'All Projects',
    mine: 'My Projects',
    starred: 'Starred Projects',
};

export const PROJECT_SCOPES: ProjectScope[] = ['all', 'mine', 'starred'];
