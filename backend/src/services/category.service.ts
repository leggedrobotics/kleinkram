import { AuthHeader } from '@/endpoints/auth/parameter-decorator';
import { CategoriesDto } from '@kleinkram/api-dto';
import { CategoryEntity } from '@kleinkram/backend-common/entities/category/category.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import logger from '../logger';

@Injectable()
export class CategoryService {
    constructor(
        @InjectRepository(CategoryEntity)
        private categoryRepository: Repository<CategoryEntity>,
        @InjectRepository(FileEntity)
        private fileEntityRepository: Repository<FileEntity>,
    ) {}

    async getAll(projectUUID: string, filter?: string): Promise<CategoriesDto> {
        const where: FindOptionsWhere<CategoryEntity> = {
            project: { uuid: projectUUID },
        };
        if (filter) {
            where.name = ILike(`%${filter}%`);
        }
        const [categories, count] = await this.categoryRepository.findAndCount({
            where,
        });

        return {
            count,
            data: categories.map((category) => ({
                uuid: category.uuid,
                name: category.name,
                description: category.description,
            })),
            take: count,
            skip: 0,
        };
    }

    async create(
        name: string,
        projectUUID: string,
        user: AuthHeader,
        description = '',
    ) {
        const category = this.categoryRepository.create({
            name,
            description,
            project: { uuid: projectUUID },
            creator: user.user,
        });
        const saved = await this.categoryRepository.save(category);
        return this.categoryRepository.findOneOrFail({
            where: { uuid: saved.uuid },
        });
    }

    /**
     * Updates the description of a category.
     *
     * The project uuid is the resource the caller was authorized against, so
     * the category is only updated if it actually belongs to that project.
     */
    async updateDescription(
        uuid: string,
        projectUUID: string,
        description: string,
    ) {
        const category = await this.categoryRepository.findOne({
            where: { uuid, project: { uuid: projectUUID } },
        });

        if (!category) {
            throw new NotFoundException(
                'Category not found in the given project',
            );
        }

        category.description = description;
        return this.categoryRepository.save(category);
    }

    async addManyCategories(
        missionUUID: string,
        files: string[],
        categories: string[],
    ) {
        // Step 1: Validate that the files belong to the mission in one query
        const validFileIds = await this.fileEntityRepository
            .createQueryBuilder('file')
            .select('file.uuid')
            .innerJoin('file.mission', 'mission')
            .where('mission.uuid = :missionUUID', { missionUUID })
            .andWhere('file.uuid IN (:...files)', { files })
            .getMany();

        const validFileUUIDs = validFileIds.map((file) => file.uuid);

        if (validFileUUIDs.length !== files.length) {
            throw new Error('Some files do not belong to the given mission.');
        }
        logger.debug('validFileUUIDs', validFileUUIDs);

        const insertValues = validFileUUIDs.flatMap((fileUUID) =>
            categories.map((categoryUUID) => ({
                fileEntityUuid: fileUUID,
                categoryUuid: categoryUUID,
            })),
        );
        logger.debug('insertValues', insertValues);

        if (insertValues.length > 0) {
            await this.fileEntityRepository.manager
                .createQueryBuilder()
                .insert()
                .into('file_entity_categories_category') // The join table for file and category
                .values(insertValues)
                .orIgnore()
                .execute();
        }

        return { success: true };
    }
}
