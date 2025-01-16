import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class OptionalPipe<T, R> implements PipeTransform {
    private readonly pipe: PipeTransform<T, R>;
    constructor(pipe: PipeTransform<T, R>) {
        this.pipe = pipe;
    }

    transform(
        value: T | undefined | null,
        metadata: ArgumentMetadata,
    ): R | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }
        return this.pipe.transform(value, metadata);
    }
}
