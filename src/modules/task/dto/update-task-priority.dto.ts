import { IsIn, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import type { TaskPriority } from '../../../schemas/task.schema';

export class UpdateTaskPriorityDto {
  @IsNotEmpty({ message: 'priority không được để trống' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsIn(['low', 'medium', 'high', 'urgent'], {
    message: 'priority phải là low, medium, high hoặc urgent',
  })
  priority!: TaskPriority;
}
