import {
  IsIn,
  IsISO8601,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { TaskPriority } from '../../../schemas/task.schema';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsIn(['low', 'medium', 'high', 'urgent'], {
    message: 'priority phải là low, medium, high hoặc urgent',
  })
  priority?: TaskPriority;

  @IsOptional()
  @IsISO8601({}, { message: 'deadline phải là thời gian ISO 8601 hợp lệ' })
  deadline?: string;

  @IsOptional()
  @IsMongoId({ message: 'assignedTo phải là MongoDB ObjectId hợp lệ' })
  assignedTo?: string;
}
