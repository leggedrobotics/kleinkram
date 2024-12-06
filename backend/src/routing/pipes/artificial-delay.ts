import { PipeTransform } from '@nestjs/common';

export class DelayPipe implements PipeTransform {
    constructor(private delay: number) {}

    async transform<T>(value: T): Promise<T> {
        await new Promise((resolve) => setTimeout(resolve, this.delay));
        return value;
    }
}
