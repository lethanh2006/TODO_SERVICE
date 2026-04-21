import { Router } from "express";
import { isAuth, isAdmin } from "../middleware/isAuth.js";
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
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo công việc thành công
 *       400:
 *         description: Thiếu tiêu đề
 *       403:
 *         description: Không có quyền
 *       500:
 *         description: Server error
 */
router.post("/", isAuth, isAdmin, createTask);

/**
 * @swagger
 * /{id}/assign:
 *   post:
 *     summary: Giao công việc cho người dùng (chỉ Admin)
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
 *               - assignTo
 *             properties:
 *               assignTo:
 *                 type: string
 *                 description: ID của người dùng được giao công việc
 *     responses:
 *       200:
 *         description: Giao công việc thành công
 *       400:
 *         description: Thiếu assignTo hoặc dữ liệu không hợp lệ từ service người dùng
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy công việc
 *       500:
 *         description: Server error
 */
router.post("/:id/assign", isAuth, isAdmin, assignTask);

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
router.get("/", isAuth, isAdmin, getAllTasks);

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
router.delete("/:id", isAuth, isAdmin, deleteTask);

export default router;
