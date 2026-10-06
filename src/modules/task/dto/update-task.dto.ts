import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { TaskPriority } from '../../../schemas/task.schema';

export class UpdateTaskDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString({ message: 'title phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @MaxLength(200)
  title?: string;

  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsString({ message: 'description phải là chuỗi ký tự hoặc null' })
  @MaxLength(2000)
  description?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsIn(['low', 'medium', 'high', 'urgent'], {
    message: 'priority phải là low, medium, high hoặc urgent',
  })
  priority?: TaskPriority;

  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsISO8601({}, { message: 'deadline phải là thời gian ISO 8601 hoặc null' })
  deadline?: string | null;
}
