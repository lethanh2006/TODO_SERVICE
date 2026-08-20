import type { Response, NextFunction } from "express";
import type { RequestWithContext } from "../common/interfaces/request-context.interface.js";

export interface AuthenticatedRequest extends RequestWithContext {
    user?: any;
}

export const isAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const payload = req.headers['x-user-payload'];
    if (typeof payload !== "string") {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    try {
        const user = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
        if (!user?._id) {
            res.status(401).json({ message: "Payload người dùng không hợp lệ" });
            return;
        }
        req.user = user;
        next();
    } catch {
        res.status(401).json({ message: "Payload người dùng không hợp lệ" });
    }
};
