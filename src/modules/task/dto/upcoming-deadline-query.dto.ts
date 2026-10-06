import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpcomingDeadlineQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'days phải là số nguyên' })
  @Min(1, { message: 'days tối thiểu là 1' })
  @Max(30, { message: 'days tối đa là 30' })
  days = 3;
}
