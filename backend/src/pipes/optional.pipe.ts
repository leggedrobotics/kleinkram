import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class OptionalPipe<T extends PipeTransform> implements PipeTransform {
    private readonly pipe: T;
    constructor(pipe: T) {
        this.pipe = pipe;
    }

    transform(
        value: unknown | undefined | null,
        metadata: ArgumentMetadata,
    ): unknown | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }
        return this.pipe.transform(value, metadata);
    }
}
