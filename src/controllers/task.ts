import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/isAuth.js";
import { Task } from "../model/Task.js";


export const createTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { title, description, priority, deadline, assignedTo } = req.body;

        const newTask = new Task({
            title,
            description,
            priority,
            deadline,
            assignedTo,
            createdBy: req.user._id
        });

        await newTask.save();
        res.status(201).json({ message: "Tạo công việc thành công", task: newTask });
    } catch (error: any) {
        res.status(500).json({ message: "Lỗi khi tạo công việc", error: error.message });
    }
};


export const assignTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { assignedTo } = req.body;

        const task = await Task.findByIdAndUpdate(
            id,
            { assignedTo },
            { new: true }
        );

        if (!task) {
            res.status(404).json({ message: "Không tìm thấy công việc" });
            return;
        }

        res.status(200).json({ message: "Giao công việc thành công", task });
    } catch (error: any) {
        res.status(500).json({ message: "Lỗi khi giao công việc", error: error.message });
    }
};


export const getAllTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tasks = await Task.find().sort({ createdAt: -1 });

        res.status(200).json({ tasks });
    } catch (error: any) {
        res.status(500).json({ message: "Lỗi khi lấy danh sách công việc", error: error.message });
    }
};


export const deleteTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const task = await Task.findByIdAndDelete(id);

        if (!task) {
            res.status(404).json({ message: "Không tìm thấy công việc" });
            return;
        }

        res.status(200).json({ message: "Xoá công việc thành công" });
    } catch (error: any) {
        res.status(500).json({ message: "Lỗi khi xoá công việc", error: error.message });
    }
};

export const getMyTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tasks = await Task.find({ assignedTo: req.user._id }).sort({ createdAt: -1 });

        res.status(200).json({ tasks });
    } catch (error: any) {
        res.status(500).json({ message: "Lỗi khi lấy danh sách công việc ", error: error.message });
    }
};


export const updateTaskStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const task = await Task.findById(id);

        if (!task) {
            res.status(404).json({ message: "Không tìm thấy công việc" });
            return;
        }

        const isAssignedUser = task.assignedTo?.toString() === req.user._id?.toString();
        const isAdmin = req.user.role === "admin";

        if (!isAssignedUser && !isAdmin) {
            res.status(403).json({ message: "Từ chối truy cập: Không được giao công việc này" });
            return;
        }

        task.status = status;
        await task.save();

        res.status(200).json({ message: "Cập nhật trạng thái công việc thành công", task });
    } catch (error: any) {
        res.status(500).json({ message: "Lỗi khi cập nhật trạng thái công việc", error: error.message });
    }
};
