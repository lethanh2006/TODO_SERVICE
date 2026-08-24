import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { MANAGEMENT_ROLES } from "../../common/enums/role.enum";
import { TaskController } from "./task.controller";

describe("TaskController role contract", () => {
  it.each(["create", "assign", "getAll", "remove"] as Array<
    keyof TaskController
  >)("cho phép khối quản trị gọi %s", (methodName) => {
    const handler = Object.getOwnPropertyDescriptor(
      TaskController.prototype,
      methodName,
    )?.value as object;

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(MANAGEMENT_ROLES);
  });
});
