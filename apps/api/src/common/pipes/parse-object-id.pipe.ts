import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

// MongoDB ObjectId: 24-char hex string
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string> {
  transform(value: string): string {
    if (!OBJECT_ID_REGEX.test(value)) {
      throw new BadRequestException(`"${value}" is not a valid ObjectId`);
    }
    return value;
  }
}
