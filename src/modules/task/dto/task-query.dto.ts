import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import type { TaskPriority, TaskStatus } from "../../../schemas/task.schema";

export class MyTaskQueryDto {
  @IsOptional()
  @IsIn(["todo", "in_progress", "done", "cancelled"], {
    message: "status phải là todo, in_progress, done hoặc cancelled",
  })
  status?: TaskStatus;

  @IsOptional()
  @IsIn(["low", "medium", "high"], {
    message: "priority phải là low, medium hoặc high",
  })
  priority?: TaskPriority;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({ message: "search phải là chuỗi ký tự" })
  @MaxLength(100, { message: "search không được dài quá 100 ký tự" })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "page phải là số nguyên" })
  @Min(1, { message: "page phải lớn hơn hoặc bằng 1" })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "limit phải là số nguyên" })
  @Min(1, { message: "limit phải lớn hơn hoặc bằng 1" })
  @Max(100, { message: "limit không được lớn hơn 100" })
  limit = 20;
}

export class TaskQueryDto extends MyTaskQueryDto {
  @IsOptional()
  @IsMongoId({ message: "assignedTo phải là MongoDB ObjectId hợp lệ" })
  assignedTo?: string;

  @IsOptional()
  @IsMongoId({ message: "createdBy phải là MongoDB ObjectId hợp lệ" })
  createdBy?: string;
}
