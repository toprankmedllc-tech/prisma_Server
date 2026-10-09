import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, PlanInterval, UpdatePlanDto } from './dto/plan.dto';
import { PlanInterval as PrismaPlanInterval } from '@prisma/client';

/** Compute the effective price after applying discount percent/amount. */
export function computeEffectiveAmount(
  amount: number,
  discountPercent?: number | null,
  discountAmount?: number | null,
): number {
  let effective = amount;
  if (discountPercent && discountPercent > 0) {
    effective = Math.round(amount * (1 - discountPercent / 100));
  } else if (discountAmount && discountAmount > 0) {
    effective = amount - discountAmount;
  }
  return Math.max(0, effective);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe | null = null;
  private readonly stripeEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const key = this.configService.get<string>('billing.stripeSecretKey');
    this.stripeEnabled = !!key;
    if (key) {
      this.stripe = new Stripe(key);
    }
  }

  /** Warn early if Stripe is not configured. */
  onModuleInit() {
    if (!this.stripeEnabled) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not set — checkout sessions will fail until it is configured.',
      );
    }
  }

  // ============================================
  // PUBLIC (CLIENT) ENDPOINTS
  // ============================================

  /** Active plans for the pricing page, ordered for display. */
  async listPublicPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { features: { orderBy: { order: 'asc' } } },
    });
  }

  // ============================================
  // ADMIN PLAN CRUD
  // ============================================

  async listPlans() {
    return this.prisma.plan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        features: { orderBy: { order: 'asc' } },
        _count: { select: { subscriptions: true } },
      },
    });
  }

  async getPlan(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { features: { orderBy: { order: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async createPlan(dto: CreatePlanDto) {
    const slug = dto.slug?.trim() || slugify(dto.name);
    const existing = await this.prisma.plan.findUnique({ where: { slug } });
    if (existing) {
      throw new BadRequestException(`A plan with slug "${slug}" already exists`);
    }

    const effectiveAmount = computeEffectiveAmount(
      dto.amount,
      dto.discountPercent,
      dto.discountAmount,
    );

    return this.prisma.plan.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        amount: dto.amount,
        currency: (dto.currency || 'usd').toLowerCase(),
        interval: dto.interval || PlanInterval.MONTH,
        discountPercent: dto.discountPercent ?? null,
        discountAmount: dto.discountAmount ?? null,
        effectiveAmount,
        isActive: dto.isActive ?? true,
        isPopular: dto.isPopular ?? false,
        sortOrder: dto.sortOrder ?? 0,
        features: dto.features?.length
          ? {
              create: dto.features.map((f, i) => ({ label: f.label, order: i })),
            }
          : undefined,
      },
      include: { features: { orderBy: { order: 'asc' } } },
    });
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');

    const amount = dto.amount ?? plan.amount;
    const discountPercent =
      dto.discountPercent === undefined ? plan.discountPercent : dto.discountPercent;
    const discountAmount =
      dto.discountAmount === undefined ? plan.discountAmount : dto.discountAmount;
    const effectiveAmount = computeEffectiveAmount(
      amount,
      discountPercent,
      discountAmount,
    );

    // Replace the feature list when provided.
    const featuresData = dto.features
      ? {
          deleteMany: {},
          create: dto.features.map((f, i) => ({ label: f.label, order: i })),
        }
      : undefined;

    const updated = await this.prisma.plan.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        amount,
        currency: dto.currency ? dto.currency.toLowerCase() : plan.currency,
        interval: dto.interval,
        discountPercent,
        discountAmount,
        effectiveAmount,
        isActive: dto.isActive,
        isPopular: dto.isPopular,
        sortOrder: dto.sortOrder,
        features: featuresData,
      },
      include: { features: { orderBy: { order: 'asc' } } },
    });

    // Keep Stripe in sync (best-effort, never blocks the admin action).
    await this.syncPlanToStripe(updated).catch((err) =>
      this.logger.warn(`Stripe sync failed for plan ${id}: ${err?.message}`),
    );

    return updated;
  }

  async deletePlan(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan._count.subscriptions > 0) {
      // Soft-disable instead of hard delete when subscribers exist.
      await this.prisma.plan.update({ where: { id }, data: { isActive: false } });
      return { deactivated: true, message: 'Plan has subscribers — deactivated instead of deleted.' };
    }
    await this.prisma.plan.delete({ where: { id } });
    return { deactivated: false, message: 'Plan deleted.' };
  }

  // ============================================
  // STRIPE SYNC
  // ============================================

  /**
   * Creates/updates the matching Stripe Product + Price for a plan and stores
   * the ids on the plan record.
   */
  private async syncPlanToStripe(plan: {
    id: string;
    name: string;
    description: string | null;
    effectiveAmount: number;
    currency: string;
    interval: PrismaPlanInterval;
    stripeProductId: string | null;
    stripePriceId: string | null;
  }) {
    if (!this.stripe) return plan;

    const productData: Stripe.ProductCreateParams = {
      name: plan.name,
      description: plan.description || undefined,
      metadata: { planId: plan.id },
    };

    let productId = plan.stripeProductId;
    if (productId) {
      await this.stripe.products.update(productId, productData);
    } else {
      const product = await this.stripe.products.create(productData);
      productId = product.id;
    }

    // Stripe requires a new Price when the amount changes; archive the old one.
    if (plan.stripePriceId) {
      const existingPrice = await this.stripe.prices.retrieve(plan.stripePriceId);
      const unchanged =
        existingPrice.unit_amount === plan.effectiveAmount &&
        existingPrice.currency === plan.currency;
      if (unchanged) {
        return this.prisma.plan.update({
          where: { id: plan.id },
          data: { stripeProductId: productId },
        });
      }
      await this.stripe.prices.update(plan.stripePriceId, { active: false });
    }

    const price = await this.stripe.prices.create({
      product: productId,
      unit_amount: plan.effectiveAmount,
      currency: plan.currency,
      recurring: {
        interval: plan.interval === PrismaPlanInterval.YEAR ? 'year' : 'month',
      },
    });

    return this.prisma.plan.update({
      where: { id: plan.id },
      data: { stripeProductId: productId, stripePriceId: price.id },
    });
  }

  /** Admin action: push a plan to Stripe immediately. */
  async syncPlan(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured on the server');
    }
    return this.syncPlanToStripe(plan);
  }

  // ============================================
  // CHECKOUT
  // ============================================

  /**
   * Creates a Stripe Checkout Session for the given plan and (new or existing)
   * user. Returns the session url the client should redirect to.
   */
  async createCheckoutSession(planId: string, userId: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured on the server');
    }

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plan not found or inactive');
    if (!plan.stripePriceId) {
      throw new BadRequestException(
        'Plan is not synced to Stripe yet. An admin must sync it first.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const frontendUrl =
      this.configService.get<string>('billing.frontendUrl') || 'http://localhost:3000';

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { userId: user.id, planId: plan.id },
      subscription_data: { metadata: { userId: user.id, planId: plan.id } },
      success_url: `${frontendUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/pricing?checkout=canceled`,
    });

    // Record the pending subscription.
    await this.prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: 'PENDING',
        stripeCheckoutSessionId: session.id,
      },
    });

    return { sessionId: session.id, url: session.url };
  }

  /**
   * Verifies a completed Checkout Session (called from the success page) and
   * activates the pending subscription.
   */
  async verifyCheckoutSession(sessionId: string, userId: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured on the server');
    }

    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      throw new BadRequestException('Checkout session is not completed yet');
    }
    if (session.metadata?.userId !== userId) {
      throw new BadRequestException('Session does not belong to this user');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeCheckoutSessionId: sessionId, userId },
    });
    if (!subscription) throw new NotFoundException('Subscription record not found');

    const stripeSubscription = session.subscription as Stripe.Subscription | null;
    const plan = await this.prisma.plan.findUnique({ where: { id: subscription.planId } });

    // Get current period from the first subscription item
    const firstItem = stripeSubscription?.items?.data?.[0];
    const currentPeriodStart = firstItem?.current_period_start
      ? new Date(firstItem.current_period_start * 1000)
      : null;
    const currentPeriodEnd = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000)
      : null;

    const activated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        stripeCustomerId:
          typeof session.customer === 'string' ? session.customer : session.customer?.id,
        stripeSubscriptionId: stripeSubscription?.id,
        currentPeriodStart,
        currentPeriodEnd,
      },
      include: { plan: true },
    });

    if (plan) {
      await this.prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          amount: plan.effectiveAmount,
          currency: plan.currency,
          status: 'SUCCEEDED',
          stripePaymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
        },
      });
    }

    return activated;
  }

  /** Current user's active subscription (for the client dashboard). */
  async getMySubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: { plan: { include: { features: { orderBy: { order: 'asc' } } } } },
    });
  }

  // ============================================
  // STRIPE WEBHOOKS
  // ============================================

  /**
   * Handles Stripe webhook events. Requires STRIPE_WEBHOOK_SECRET to verify
   * signatures; the raw body must be attached by the body parser (see main.ts).
   */
  async handleStripeWebhook(signature: string | undefined, rawBody?: Buffer) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured on the server');
    }
    const secret = this.configService.get<string>('billing.stripeWebhookSecret');
    if (!secret || !signature || !rawBody) {
      throw new BadRequestException('Webhook signature verification failed');
    }

    const event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    this.logger.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.onSubscriptionChange(sub);
        break;
      }
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        await this.onInvoiceEvent(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
    return { received: true };
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const record = await this.prisma.subscription.findFirst({
      where: { stripeCheckoutSessionId: session.id },
    });
    if (!record) {
      this.logger.warn(`No subscription record for checkout session ${session.id}`);
      return;
    }

    const stripeSubscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    await this.prisma.subscription.update({
      where: { id: record.id },
      data: {
        status: 'ACTIVE',
        stripeCustomerId:
          typeof session.customer === 'string' ? session.customer : session.customer?.id,
        stripeSubscriptionId: stripeSubscriptionId ?? null,
      },
    });
    this.logger.log(`Subscription ${record.id} activated via checkout`);
  }

  private async onSubscriptionChange(stripeSubscription: Stripe.Subscription) {
    const record = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: stripeSubscription.id },
    });
    if (!record) return;

    const statusMap: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'PENDING'> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      trialing: 'TRIALING',
      incomplete: 'PENDING',
      unpaid: 'PAST_DUE',
    };

    // Get current period from the first subscription item
    const firstItem = stripeSubscription.items?.data?.[0];
    const currentPeriodStart = firstItem?.current_period_start
      ? new Date(firstItem.current_period_start * 1000)
      : null;
    const currentPeriodEnd = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000)
      : null;

    await this.prisma.subscription.update({
      where: { id: record.id },
      data: {
        status: statusMap[stripeSubscription.status] ?? 'PENDING',
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        canceledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null,
      },
    });
  }

  private async onInvoiceEvent(invoice: Stripe.Invoice) {
    // In newer Stripe SDK, subscription and payment_intent are accessed differently
    // The subscription ID is stored in the invoice's metadata or we need to look it up
    const subscriptionId = (invoice as any).subscription as string | null | undefined;
    const paymentIntentId = (invoice as any).payment_intent as string | null | undefined;

    const record = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId ?? null },
    });
    if (!record) return;

    // In newer Stripe SDK, invoice.paid is invoice.status === 'paid'
    const succeeded = invoice.status === 'paid';
    await this.prisma.payment.create({
      data: {
        subscriptionId: record.id,
        amount: invoice.amount_paid || invoice.amount_due,
        currency: invoice.currency,
        status: succeeded ? 'SUCCEEDED' : 'FAILED',
        stripePaymentIntentId:
          typeof paymentIntentId === 'string' ? paymentIntentId : null,
      },
    });
  }
}
