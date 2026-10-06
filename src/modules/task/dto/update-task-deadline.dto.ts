import { IsDateString, IsNotEmpty } from 'class-validator';

export class UpdateTaskDeadlineDto {
  @IsNotEmpty({ message: 'deadline không được để trống' })
  @IsDateString({}, { message: 'deadline phải là định dạng ISO 8601 hợp lệ' })
  deadline!: string;
}
