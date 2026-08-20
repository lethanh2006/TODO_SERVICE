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

router.get("/my-tasks", isAuth, getMyTasks);
router.patch("/:id/status", isAuth, updateTaskStatus);
router.post("/", isAuth, createTask);
router.patch("/:id/assign", isAuth, assignTask);
router.get("/", isAuth, getAllTasks);
router.delete("/:id", isAuth, deleteTask);

export default router;
