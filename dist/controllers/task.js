import mongoose from "mongoose";
import { Task } from "../model/Task.js";
const TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"];
const isTaskStatus = (value) => typeof value === "string" && TASK_STATUSES.some((status) => status === value);
const getUserServiceUrl = () => (process.env.USER_SERVICE_URL || process.env.USER_SERVICE || "http://localhost:5000")
    .replace(/\/+$/, "");
const isAdmin = (req) => req.user?.role?.toString().toLowerCase() === "admin";
const rejectNonAdmin = (req, res) => {
    if (isAdmin(req))
        return false;
    res.status(403).json({ message: "Từ chối truy cập: Chỉ Admin được thực hiện thao tác này" });
    return true;
};
const isExistingUser = async (userId) => {
    if (!mongoose.isValidObjectId(userId))
        return false;
    const response = await fetch(`${getUserServiceUrl()}/api/user/internal/${encodeURIComponent(userId)}`);
    return response.ok;
};
const isValidTaskId = (id, res) => {
    if (mongoose.isValidObjectId(id))
        return true;
    res.status(400).json({ message: "ID công việc không hợp lệ" });
    return false;
};
export const createTask = async (req, res) => {
    try {
        if (rejectNonAdmin(req, res))
            return;
        const { title, description, priority, deadline, assignedTo } = req.body;
        if (typeof title !== "string" || !title.trim()) {
            res.status(400).json({ message: "Tiêu đề không được để trống" });
            return;
        }
        if (assignedTo && !(await isExistingUser(String(assignedTo)))) {
            res.status(400).json({ message: "Người dùng được giao không tồn tại" });
            return;
        }
        const newTask = new Task({
            title: title.trim(),
            description,
            priority,
            deadline,
            assignedTo,
            createdBy: req.user._id
        });
        await newTask.save();
        res.status(201).json({ message: "Tạo công việc thành công", task: newTask });
    }
    catch (error) {
        res.status(500).json({ message: "Lỗi khi tạo công việc", error: error.message });
    }
};
export const assignTask = async (req, res) => {
    try {
        if (rejectNonAdmin(req, res))
            return;
        const { id } = req.params;
        const { assignedTo } = req.body;
        if (!isValidTaskId(id, res))
            return;
        if (!assignedTo) {
            res.status(400).json({ message: "Cần cung cấp người được giao" });
            return;
        }
        const taskToUpdate = await Task.findById(id);
        if (!taskToUpdate) {
            res.status(404).json({ message: "Không tìm thấy công việc" });
            return;
        }
        try {
            if (!(await isExistingUser(String(assignedTo)))) {
                res.status(400).json({ message: "Người dùng được giao không tồn tại" });
                return;
            }
        }
        catch (err) {
            console.error("Lỗi khi kiểm tra user:", err);
            res.status(503).json({ message: "Không kết nối được dịch vụ người dùng" });
            return;
        }
        taskToUpdate.assignedTo = assignedTo;
        await taskToUpdate.save();
        res.status(200).json({ message: "Giao lại công việc thành công", task: taskToUpdate });
    }
    catch (error) {
        res.status(500).json({ message: "Lỗi khi giao lại công việc", error: error.message });
    }
};
const populateUsersInTasks = async (tasks, userPayload) => {
    try {
        const usersResponse = await fetch(`${getUserServiceUrl()}/api/user/user/all`, {
            headers: {
                "x-user-payload": userPayload || ""
            }
        });
        if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            const usersMap = new Map();
            if (usersData.users && Array.isArray(usersData.users)) {
                usersData.users.forEach((u) => usersMap.set(u._id.toString(), {
                    _id: u._id,
                    username: u.username,
                    email: u.email
                }));
            }
            return tasks.map(task => ({
                ...task,
                createdBy: usersMap.get(task.createdBy?.toString()) || task.createdBy,
                assignedTo: usersMap.get(task.assignedTo?.toString()) || task.assignedTo
            }));
        }
    }
    catch (err) {
        console.error("Lỗi khi fetch users để populate:", err);
    }
    return tasks;
};
export const getAllTasks = async (req, res) => {
    try {
        if (rejectNonAdmin(req, res))
            return;
        const tasks = await Task.find().sort({ createdAt: -1 }).lean();
        const populatedTasks = await populateUsersInTasks(tasks, typeof req.headers["x-user-payload"] === "string" ? req.headers["x-user-payload"] : undefined);
        res.status(200).json({ tasks: populatedTasks });
    }
    catch (error) {
        res.status(500).json({ message: "Lỗi khi lấy danh sách công việc", error: error.message });
    }
};
export const deleteTask = async (req, res) => {
    try {
        if (rejectNonAdmin(req, res))
            return;
        const { id } = req.params;
        if (!isValidTaskId(id, res))
            return;
        const task = await Task.findByIdAndDelete(id);
        if (!task) {
            res.status(404).json({ message: "Không tìm thấy công việc" });
            return;
        }
        res.status(200).json({ message: "Xoá công việc thành công" });
    }
    catch (error) {
        res.status(500).json({ message: "Lỗi khi xoá công việc", error: error.message });
    }
};
export const getMyTasks = async (req, res) => {
    try {
        const tasks = await Task.find({ assignedTo: req.user._id }).sort({ createdAt: -1 }).lean();
        const populatedTasks = await populateUsersInTasks(tasks, typeof req.headers["x-user-payload"] === "string" ? req.headers["x-user-payload"] : undefined);
        res.status(200).json({ tasks: populatedTasks });
    }
    catch (error) {
        res.status(500).json({ message: "Lỗi khi lấy danh sách công việc ", error: error.message });
    }
};
export const updateTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!isValidTaskId(id, res))
            return;
        if (!isTaskStatus(status)) {
            res.status(400).json({ message: "Trạng thái công việc không hợp lệ" });
            return;
        }
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
    }
    catch (error) {
        res.status(500).json({ message: "Lỗi khi cập nhật trạng thái công việc", error: error.message });
    }
};
