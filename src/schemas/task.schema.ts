import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  Schema as MongooseSchema,
  Types,
  type HydratedDocument,
} from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high';

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

  @Prop({ type: String, enum: ['low', 'medium', 'high'], default: 'medium' })
  priority!: TaskPriority;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop()
  deadline?: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
