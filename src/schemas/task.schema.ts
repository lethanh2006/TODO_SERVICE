import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  Types,
  type HydratedDocument,
} from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITY_ORDER: Readonly<Record<TaskPriority, number>> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

@Schema({ timestamps: true, collection: 'tasks' })
export class Task {
  @Prop({ required: true })
  title!: string;

  @Prop()
  description?: string;

  @Prop({
    type: String,
    enum: ['todo', 'in_progress', 'done', 'cancelled'],
    default: 'todo',
  })
  status!: TaskStatus;

  @Prop({
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  })
  priority!: TaskPriority;

  @Prop({ type: Number, default: 2 })
  priorityOrder!: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop()
  deadline?: Date;

  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  progress!: number;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

TaskSchema.index({ assignedTo: 1, createdAt: -1, _id: -1 });
TaskSchema.index({ createdBy: 1, createdAt: -1, _id: -1 });
TaskSchema.index({ deadline: 1 });
TaskSchema.index({ status: 1, deadline: 1 });
