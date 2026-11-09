import { ALL_ENTITIES } from '@kleinkram/backend-common';
import { KEEP_UPDATED_AT } from '@kleinkram/backend-common/entities/base-entity.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { DataSource } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

/**
 * Builds the entity metadata without opening a connection, which is all
 * `getQuery()` needs to render the SQL of an update.
 */
const offlineDataSource = async (): Promise<DataSource> => {
    const dataSource = new DataSource({
        type: 'postgres',
        entities: ALL_ENTITIES,
    });
    await (
        dataSource as unknown as { buildMetadatas: () => Promise<void> }
    ).buildMetadatas();
    return dataSource;
};

const updateSql = (
    dataSource: DataSource,
    values: QueryDeepPartialEntity<FileEntity>,
): string =>
    dataSource
        .createQueryBuilder()
        .update(FileEntity)
        .set(values)
        .where('uuid = :uuid', { uuid: 'x' })
        .getQuery();

describe('KEEP_UPDATED_AT', () => {
    let dataSource: DataSource;

    beforeAll(async () => {
        dataSource = await offlineDataSource();
    });

    test('a plain update bumps updatedAt', () => {
        expect(updateSql(dataSource, { hash: 'h' })).toContain(
            '"updatedAt" = CURRENT_TIMESTAMP',
        );
    });

    test('an update with KEEP_UPDATED_AT leaves updatedAt as it is', () => {
        const sql = updateSql(dataSource, { hash: 'h', ...KEEP_UPDATED_AT });

        expect(sql).not.toContain('CURRENT_TIMESTAMP');
        expect(sql).toContain('"updatedAt" = "updatedAt"');
    });
});
