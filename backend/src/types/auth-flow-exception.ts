import { HttpStatus } from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';

export class AuthFlowException extends HttpException {
    constructor(message: string, redirectUrl?: string) {
        super({ message, redirectUrl }, HttpStatus.UNAUTHORIZED);
    }
}
