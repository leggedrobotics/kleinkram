import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Tag from '@common/entities/tag/tag.entity';
import { TagService } from './tag.service';
import { TagController } from './tag.controller';
import TagType from '@common/entities/tagType/tagType.entity';
import Mission from '@common/entities/mission/mission.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Tag, TagType, Mission])],
    providers: [TagService],
    controllers: [TagController],
    exports: [TagService],
})
export class TagModule {}
