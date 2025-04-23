import { CategoriesDto } from '@common/api/types/category.dto';
import Category from '@common/entities/category/category.entity';
import FileEntity from '@common/entities/file/file.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { AuthHeader } from '../endpoints/auth/parameter-decorator';
import logger from '../logger';

@Injectable()
export class CategoryService {
    constructor(
        @InjectRepository(Category)
        private categoryRepository: Repository<Category>,
        @InjectRepository(FileEntity)
        private fileEntityRepository: Repository<FileEntity>,
    ) {}

    async getAll(projectUUID: string, filter?: string): Promise<CategoriesDto> {
        const where: FindOptionsWhere<Category> = {
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
            })),
            take: count,
            skip: 0,
        };
    }

    async create(name: string, projectUUID: string, user: AuthHeader) {
        const category = this.categoryRepository.create({
            name,
            project: { uuid: projectUUID },
            creator: user.user,
        });
        const saved = await this.categoryRepository.save(category);
        return this.categoryRepository.findOneOrFail({
            where: { uuid: saved.uuid },
        });
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
