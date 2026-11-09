import { projectAccessesToProjectDtos } from '@/serialization';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { AccessGroupRights } from '@kleinkram/shared';

const access = (project: unknown): ProjectAccessEntity =>
    ({
        rights: AccessGroupRights.READ,
        project,
    }) as ProjectAccessEntity;

const project = {
    uuid: 'a2d3f7e0-0000-4000-8000-000000000001',
    name: 'project',
    description: 'a project',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    autoConvert: true,
};

describe('projectAccessesToProjectDtos', () => {
    test('maps a loaded project access to a DTO', () => {
        const dtos = projectAccessesToProjectDtos([access(project)]);

        expect(dtos).toHaveLength(1);
        expect(dtos[0]).toEqual({
            uuid: project.uuid,
            name: project.name,
            description: project.description,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            autoConvert: true,
            rights: AccessGroupRights.READ,
        });
    });

    // TypeORM resolves the relation to `null` when the project row is
    // soft-deleted, which used to throw while reading `project.createdAt`.
    test('skips accesses whose project is null or undefined', () => {
        expect(
            projectAccessesToProjectDtos([
                access(null),
                access(undefined),
                access(project),
            ]),
        ).toHaveLength(1);
    });

    test('returns an empty list for missing relations', () => {
        expect(projectAccessesToProjectDtos(undefined)).toEqual([]);
        expect(projectAccessesToProjectDtos(null)).toEqual([]);
    });
});
