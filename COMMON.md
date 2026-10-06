# Luồng dùng chung của Todo

Đọc theo thứ tự: `src/main.ts` → `src/core/core.module.ts` → `src/modules/task/task.controller.ts` → `task.service.ts`.

1. `main.ts` khởi tạo Nest, logger và `ValidationPipe`. `CoreModule` đăng ký middleware, filter, logger và dịch vụ kiểm tra chữ ký Gateway.
2. `common/middleware/request-id.middleware.ts` giữ hoặc tạo request ID, đưa vào request/response và ngữ cảnh log.
3. `common/guards/roles.guard.ts` đọc `@Authenticated()` / `@Roles()` từ `common/decorators`. Với endpoint cần xác thực, guard gọi `common/security/gateway-signature.service.ts`, kiểm tra chữ ký và chống phát lại, rồi đọc user bằng `common/utils/authenticated-user.util.ts`.
4. `TaskController` nhận request đã xác thực và gọi `TaskService`. `common/enums/role.enum.ts` định nghĩa role; `common/utils/role.util.ts` kiểm tra nhóm quản lý. Kiểu user và request nằm trong `common/interfaces`.
5. Khi có lỗi, `common/filters/global-exception.filter.ts` gọi `StructuredLoggerService.handleHttpException` để trả lỗi theo hợp đồng hiện tại và ghi log. `common/logging/logger.ts` tập trung logger, adapter Nest và `LoggerLifecycleService` để flush log khi dừng ứng dụng.

`common` chỉ chứa thành phần dùng xuyên module. Nghiệp vụ công việc, gọi User service, DTO và schema nằm tại module/schema tương ứng. Chữ ký Gateway, cửa sổ chống phát lại và việc flush log đều được dùng khi chạy production.

Chạy kiểm tra: `npm run format:check`, `npm run lint`, `npm run build`, `npm test -- --runInBand`.

Todo hỗ trợ mức ưu tiên `urgent`, tiến độ `0–100`, bộ lọc khoảng hạn chót và
sắp xếp theo ưu tiên/hạn chót/ngày tạo/ngày sửa/tiêu đề. Nhóm quản lý cập nhật
ưu tiên qua `PATCH /api/todo/:id/priority` và hạn chót qua
`PATCH /api/todo/:id/deadline`. Người được giao hoặc nhóm quản lý cập nhật tiến
độ qua `PATCH /api/todo/:id/progress` khi task đang `in_progress`.
`GET /api/todo/overdue` và `GET /api/todo/upcoming-deadline?days=3` giới hạn dữ
liệu theo người đăng nhập; nhóm quản lý xem được toàn bộ.

Sắp xếp ưu tiên tính thứ hạng từ trường `priority`, nên task cũ chưa có
`priorityOrder` vẫn được sắp xếp đúng mà không cần backfill database production.
Để kiểm tra dữ liệu cũ và phân trang bằng MongoDB thật, đặt
`TODO_TEST_MONGO_URL` tới MongoDB dành riêng cho test rồi chạy
`npm test -- --runInBand`. Bài integration tạo và xóa database tạm với tên
ngẫu nhiên; không đặt biến này thì chỉ chạy các bài unit test.
