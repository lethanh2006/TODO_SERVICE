import { IsIn, IsNotEmpty } from 'class-validator';
import type { TaskStatus } from '../../../schemas/task.schema';

export class UpdateTaskStatusDto {
  @IsNotEmpty()
  @IsIn(['todo', 'in_progress', 'done', 'cancelled'], {
    message: 'status phải là todo, in_progress, done hoặc cancelled',
  })
  status!: TaskStatus;
}
