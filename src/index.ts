import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDb from './config/db.js';
import taskRoutes from './routes/task.js';
import { globalExceptionFilter } from './common/filters/global-exception.filter.js';
import { httpLoggingInterceptor } from './common/interceptors/http-logging.interceptor.js';
import { requestIdMiddleware } from './common/middleware/request-id.middleware.js';

dotenv.config();

connectDb();

const app = express();

app.use(requestIdMiddleware);
app.use(httpLoggingInterceptor);
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'todo' });
});

app.use("/api/todo", taskRoutes);

app.use((_request, _response, next) => {
  const notFoundError = Object.assign(new Error('Not Found'), { status: 404 });
  next(notFoundError);
});
app.use(globalExceptionFilter);

const port = process.env.PORT || 5003;

app.listen(port, () => {
    console.log(`Todo service is running on port ${port}`);
});
