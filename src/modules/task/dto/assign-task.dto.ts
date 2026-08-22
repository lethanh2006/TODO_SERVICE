import { IsMongoId, IsNotEmpty } from "class-validator";

export class AssignTaskDto {
  @IsNotEmpty({ message: "Cần cung cấp người được giao" })
  @IsMongoId({ message: "assignedTo phải là MongoDB ObjectId hợp lệ" })
  assignedTo!: string;
}
