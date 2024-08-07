import { define } from 'typeorm-seeding';
import Project from '../../entities/project/project.entity';
import User from '../../entities/user/user.entity';
import { extendedFaker } from '../../faker_extended';

export type ProjectContext = {
    name: string;
    user: User;
};

define(Project, (_, context: Partial<ProjectContext> = {}) => {
    const project = new Project();
    project.uuid = extendedFaker.string.uuid();
    project.name =
        context?.name ||
        `${extendedFaker.project.name()} [${extendedFaker.string.uuid().substring(0, 5)}]`;
    project.creator = context?.user || null;
    project.description = extendedFaker.lorem.paragraph();
    return project;
});
