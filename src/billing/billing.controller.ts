import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';

interface RequestWithUser extends Request {
  user: { id: string; email: string };
}

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billingService: BillingService) {}

  // ============================================
  // PUBLIC — pricing page data
  // ============================================
  @Get('plans')
  @ApiOperation({ summary: 'List active plans for the pricing page' })
  listPublicPlans() {
    return this.billingService.listPublicPlans();
  }

  // ============================================
  // AUTHENTICATED — checkout & my subscription
  // ============================================
  @UseGuards(JwtAuthGuard)
  @Post('checkout/:planId')
  @ApiOperation({ summary: 'Create a Stripe Checkout session for a plan' })
  createCheckout(
    @Param('planId') planId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.billingService.createCheckoutSession(planId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('checkout/verify')
  @ApiOperation({ summary: 'Verify a completed Stripe Checkout session' })
  verifyCheckout(
    @Query('sessionId') sessionId: string,
    @Req() req: RequestWithUser,
  ) {
    if (!sessionId) throw new BadRequestException('sessionId is required');
    return this.billingService.verifyCheckoutSession(sessionId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription/me')
  @ApiOperation({ summary: "Current user's active subscription" })
  getMySubscription(@Req() req: RequestWithUser) {
    return this.billingService.getMySubscription(req.user.id);
  }

  // ============================================
  // ADMIN — plan management
  // ============================================
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/plans')
  @ApiOperation({ summary: 'List all plans (including inactive)' })
  listPlans() {
    return this.billingService.listPlans();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/plans/:id')
  @ApiOperation({ summary: 'Get a single plan' })
  getPlan(@Param('id') id: string) {
    return this.billingService.getPlan(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/plans')
  @ApiOperation({ summary: 'Create a plan' })
  createPlan(@Body() dto: CreatePlanDto) {
    return this.billingService.createPlan(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/plans/:id')
  @ApiOperation({ summary: 'Update a plan' })
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.billingService.updatePlan(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/plans/:id')
  @ApiOperation({ summary: 'Delete (or deactivate) a plan' })
  deletePlan(@Param('id') id: string) {
    return this.billingService.deletePlan(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/plans/:id/sync')
  @ApiOperation({ summary: 'Sync a plan to Stripe (create product/price)' })
  syncPlan(@Param('id') id: string) {
    return this.billingService.syncPlan(id);
  }

  // ============================================
  // STRIPE WEBHOOK (raw body handled in main.ts)
  // ============================================
  @Post('webhooks/stripe')
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async handleWebhook(@Req() request: Request) {
    const signature = request.headers['stripe-signature'] as string | undefined;
    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;
    try {
      await this.billingService.handleStripeWebhook(signature, rawBody);
      return { received: true };
    } catch (err) {
      this.logger.error(`Stripe webhook error: ${err?.message}`);
      throw new BadRequestException(`Webhook error: ${err?.message}`);
    }
  }
}
