import mongoose, { Document, Schema } from "mongoose";

export interface ITask extends Document {
    title: string;
    description?: string;
    status: 'todo' | 'in_progress' | 'done' | 'cancelled';
    priority: 'low' | 'medium' | 'high';
    createdBy: mongoose.Types.ObjectId;
    assignedTo?: mongoose.Types.ObjectId;
    deadline?: Date;
}

const taskSchema: Schema<ITask> = new Schema(
    {
        title: { type: String, required: true },
        description: { type: String },
        status: { 
            type: String, 
            enum: ['todo', 'in_progress', 'done', 'cancelled'], 
            default: 'todo' 
        },
        priority: { 
            type: String, 
            enum: ['low', 'medium', 'high'], 
            default: 'medium' 
        },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
        deadline: { type: Date }
    },
    { timestamps: true }
);

export const Task = mongoose.model<ITask>("Task", taskSchema);
