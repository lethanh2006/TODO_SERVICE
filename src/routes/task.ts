import { Router } from "express";
import { isAuth } from "../middleware/isAuth.js";
import {
    createTask,
    assignTask,
    getAllTasks,
    deleteTask,
    getMyTasks,
    updateTaskStatus
} from "../controllers/task.js";

const router = Router();

/**
 * @swagger
 * /my-tasks:
 *   get:
 *     summary: Lấy danh sách công việc của người dùng hiện tại
 *     tags: [TODO]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách các công việc được giao cho người dùng
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Server error
 */
router.get("/my-tasks", isAuth, getMyTasks);
/**
 * @swagger
 * /{id}/status:
 *   patch:
 *     summary: Cập nhật trạng thái của một công việc
 *     tags: [TODO]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của công việc
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, IN_PROGRESS, COMPLETED]
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
 *       400:
 *         description: Trạng thái không hợp lệ
 *       403:
 *         description: Không có quyền cập nhật công việc này
 *       404:
 *         description: Không tìm thấy công việc
 *       500:
 *         description: Server error
 */
router.patch("/:id/status", isAuth, updateTaskStatus);



/**
 * @swagger
 * /:
 *   post:
 *     summary: Tạo công việc mới (chỉ Admin)
 *     tags: [TODO]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Tiêu đề công việc (bắt buộc)
 *               description:
 *                 type: string
 *                 description: Mô tả chi tiết công việc
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *                 description: Mức độ ưu tiên của công việc
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 description: Hạn chót hoàn thành công việc (ISO string)
 *               assignedTo:
 *                 type: string
 *                 description: ID của người dùng được giao công việc ngay lúc tạo
 *     responses:
 *       201:
 *         description: Tạo công việc thành công
 *       400:
 *         description: Thiếu tiêu đề hoặc dữ liệu không hợp lệ
 *       403:
 *         description: Không có quyền
 *       500:
 *         description: Lỗi server nội bộ
 */
router.post("/", isAuth, createTask);

/**
 * @swagger
 * /{id}/assign:
 *   patch:
 *     summary: Giao lại công việc cho người dùng (chỉ Admin)
 *     tags: [TODO]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của công việc
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assignedTo
 *             properties:
 *               assignedTo:
 *                 type: string
 *                 description: ID của người dùng được giao công việc
 *     responses:
 *       200:
 *         description: Giao lại công việc thành công
 *       400:
 *         description: Người dùng được giao không tồn tại hoặc dữ liệu không hợp lệ
 *       403:
 *         description: Không có quyền giao lại công việc này
 *       404:
 *         description: Không tìm thấy công việc
 *       500:
 *         description: Server error
 */
router.patch("/:id/assign", isAuth, assignTask);

/**
 * @swagger
 * /:
 *   get:
 *     summary:  Lấy tất cả công việc (chỉ Admin)
 *     tags: [TODO]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách tất cả công việc
 *       403:
 *         description: Không có quyền
 *       500:
 *         description: Server error
 */
router.get("/", isAuth, getAllTasks);

/**
 * @swagger
 * /{id}:
 *   delete:
 *     summary: Xóa công việc (chỉ Admin)
 *     tags: [TODO]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của công việc
 *     responses:
 *       200:
 *         description: Xóa công việc thành công
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy công việc
 *       500:
 *         description: Server error
 */
router.delete("/:id", isAuth, deleteTask);

export default router;
