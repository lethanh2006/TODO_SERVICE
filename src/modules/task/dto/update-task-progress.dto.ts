import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateTaskProgressDto {
  @Type(() => Number)
  @IsInt({ message: 'progress phải là số nguyên' })
  @Min(0, { message: 'progress tối thiểu là 0' })
  @Max(100, { message: 'progress tối đa là 100' })
  progress!: number;
}
