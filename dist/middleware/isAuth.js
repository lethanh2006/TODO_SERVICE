export const isAuth = (req, res, next) => {
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
    }
    catch {
        res.status(401).json({ message: "Payload người dùng không hợp lệ" });
    }
};
