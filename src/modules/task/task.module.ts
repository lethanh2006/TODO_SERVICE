import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Task, TaskSchema } from '../../schemas/task.schema';
import { UserClientModule } from '../user-client/user-client.module';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { GatewaySignatureService } from '../../common/security/gateway-signature.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    UserClientModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, RolesGuard, GatewaySignatureService],
})
export class TaskModule {}
