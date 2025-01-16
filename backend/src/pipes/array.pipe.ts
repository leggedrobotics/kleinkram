import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class ArrayPipe implements PipeTransform {
    constructor(private readonly pipe: PipeTransform) {}
    async transform(
        value: unknown,
        metadata: ArgumentMetadata,
    ): Promise<unknown> {
        if (!Array.isArray(value)) {
            return [this.pipe.transform(value, metadata)];
        } else {
            return value.map((val) => this.pipe.transform(val, metadata));
        }
    }
}
