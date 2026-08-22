import {
  IsIn,
  IsISO8601,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import type { TaskPriority } from "../../../schemas/task.schema";

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty({ message: "Tiêu đề không được để trống" })
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(["low", "medium", "high"], {
    message: "priority phải là low, medium hoặc high",
  })
  priority?: TaskPriority;

  @IsOptional()
  @IsISO8601({}, { message: "deadline phải là thời gian ISO 8601 hợp lệ" })
  deadline?: string;

  @IsOptional()
  @IsMongoId({ message: "assignedTo phải là MongoDB ObjectId hợp lệ" })
  assignedTo?: string;
}
