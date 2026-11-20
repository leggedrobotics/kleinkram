import { AuthHeader } from '@/endpoints/auth/parameter-decorator';
import { CategoryService } from '@/services/category.service';
import { CategoryEntity } from '@kleinkram/backend-common/entities/category/category.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { ConflictException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';

const auth = { user: { uuid: 'user' } } as unknown as AuthHeader;

describe('Category Service', () => {
    test('should return 409 if a concurrent request took the name after the check', async () => {
        // the up-front check finds nothing, the insert then hits the unique
        // index because another request saved the same name in between
        const categoryRepository = {
            exists: jest.fn().mockResolvedValue(false),
            create: jest.fn((value: unknown) => value),
            save: jest.fn().mockRejectedValue(
                new QueryFailedError(
                    'INSERT',
                    [],
                    Object.assign(new Error('duplicate key'), {
                        code: '23505',
                    }),
                ),
            ),
        } as unknown as Repository<CategoryEntity>;
        const service = new CategoryService(
            categoryRepository,
            {} as Repository<FileEntity>,
        );

        const creation = service.create('Raw Data', 'project', auth);

        await expect(creation).rejects.toThrow(ConflictException);
        await expect(creation).rejects.toThrow(
            'A category named "Raw Data" already exists in this project',
        );
    });

    test('should not hide other database errors', async () => {
        const categoryRepository = {
            exists: jest.fn().mockResolvedValue(false),
            create: jest.fn((value: unknown) => value),
            save: jest
                .fn()
                .mockRejectedValue(new Error('connection terminated')),
        } as unknown as Repository<CategoryEntity>;
        const service = new CategoryService(
            categoryRepository,
            {} as Repository<FileEntity>,
        );

        await expect(
            service.create('Raw Data', 'project', auth),
        ).rejects.toThrow('connection terminated');
    });
});
