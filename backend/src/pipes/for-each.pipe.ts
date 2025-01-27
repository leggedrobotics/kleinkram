import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class ForEachPipe implements PipeTransform {
    constructor(private readonly pipe: PipeTransform) {}
    async transform(
        value: unknown,
        metadata: ArgumentMetadata,
    ): Promise<unknown[]> {
        if (!Array.isArray(value)) {
            return [await this.pipe.transform(value, metadata)];
        } else {
            return Promise.all(
                value.map((v) => this.pipe.transform(v, metadata)),
            );
        }
    }
}
