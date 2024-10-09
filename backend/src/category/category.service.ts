import { Injectable } from '@nestjs/common';
import FileEntity from '@common/entities/file/file.entity';
import { ILike, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import Project from '@common/entities/project/project.entity';
import Category from '@common/entities/category/category.entity';
import { AuthRes } from '../auth/paramDecorator';

@Injectable()
export class CategoryService {
    constructor(
        @InjectRepository(Category)
        private categoryRepository: Repository<Category>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(FileEntity)
        private fileEntityRepository: Repository<FileEntity>,
    ) {}

    async getAll(projectUUID: string, filter?: string) {
        const where = {
            project: { uuid: projectUUID },
        };
        if (filter) {
            where['name'] = ILike(`%${filter}%`);
        }
        return this.categoryRepository.findAndCount({
            where,
        });
    }

    async create(name: string, projectUUID: string, user: AuthRes) {
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
}
