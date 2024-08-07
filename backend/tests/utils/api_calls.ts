import { CreateProject } from '../../src/project/entities/create-project.dto';
import { get_jwt_token } from './database_utils';
import User from '@common/entities/user/user.entity';

export const create_project_using_post = async (
    project: CreateProject,
    user?: User,
): Promise<string> => {
    const res = await fetch(`http://localhost:3000/project/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            cookie: `authtoken=${await get_jwt_token(user)}`,
        },
        body: JSON.stringify(project),
        credentials: 'include',
    });

    // check if the request was successful
    expect(res.status).toBeLessThan(300);
    return (await res.json()).uuid;
};
