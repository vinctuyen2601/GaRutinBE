import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationChannelDto, UpdateNotificationChannelDto } from './dto/notification-channel.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/notification-channels')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  findAll() { return this.svc.findAll(); }

  @Post()
  create(@Body() dto: CreateNotificationChannelDto) { return this.svc.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNotificationChannelDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/test')
  test(@Param('id') id: string) { return this.svc.test(id); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
