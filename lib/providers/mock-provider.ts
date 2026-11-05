import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { MessageProvider, SendMessageParams, SendMessageResult } from "./types";

export class MockProvider implements MessageProvider {
  name = "mock";

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    const { phone } = params;

    // Simulate permanent failure on test numbers ending with 0000
    if (phone.endsWith("0000")) {
      return {
        success: false,
        status: "failed",
        errorMessage: "MockProvider: Phone number is inactive or invalid (permanent failure)",
        retryable: false,
      };
    }

    // Simulate temporary retryable network error on test numbers ending with 9999
    if (phone.endsWith("9999")) {
      return {
        success: false,
        status: "failed",
        errorMessage: "MockProvider: Temporary rate limit or network glitch (retryable)",
        retryable: true,
      };
    }

    // Successful send
    const externalMessageId = `mock_msg_${crypto.randomBytes(8).toString("hex")}`;

    return {
      success: true,
      externalMessageId,
      status: "sent",
    };
  }

  /**
   * Helper for tests or admin tools to simulate delivery status transitions
   * (e.g. sent -> delivered -> read)
   */
  async simulateStatusTransition(
    externalMessageId: string,
    newStatus: "delivered" | "read" | "failed"
  ): Promise<boolean> {
    const now = new Date();
    const log = await prisma.messageLog.findFirst({
      where: { externalMessageId },
    });

    if (!log) return false;

    const data: Record<string, unknown> = { status: newStatus };
    if (newStatus === "delivered") data.deliveredAt = now;
    if (newStatus === "read") {
      data.readAt = now;
      if (!log.deliveredAt) data.deliveredAt = now;
    }

    await prisma.messageLog.update({
      where: { id: log.id },
      data,
    });

    if (newStatus === "delivered" || newStatus === "read") {
      await prisma.guest.update({
        where: { id: log.guestId },
        data: { inviteStatus: newStatus },
      });
    }

    return true;
  }
}

export const mockProvider = new MockProvider();
