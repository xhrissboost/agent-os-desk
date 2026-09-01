import { createHash } from "node:crypto";
import {
  B402_TESTNET_CAIP,
  DEMO_COUNTERPARTY_PAY_TO,
  MEMO_AMOUNT_ATOMIC,
  MEMO_PRICE_USD,
  USDT_BSC,
} from "../config.js";
import type { GatedMemo, PaymentRequired } from "../types.js";

export const MEMO_URL = "desk://counterparty/alpha-memo";

export function merchantRequirement(): PaymentRequired {
  return {
    x402Version: 2,
    error: "PAYMENT-SIGNATURE header is required",
    resource: {
      url: MEMO_URL,
      description: "Gated Alpha Memo — BNBUSDT research sold agent-to-agent",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: B402_TESTNET_CAIP,
        amount: MEMO_AMOUNT_ATOMIC,
        asset: USDT_BSC,
        payTo: DEMO_COUNTERPARTY_PAY_TO,
        maxTimeoutSeconds: 60,
        extra: { name: "USDT", decimals: "6", amountUsd: String(MEMO_PRICE_USD), settlement: "local-merchant" },
      },
    ],
    extensions: { desk: { merchant: "ScoutPay Counterparty", capUsd: "1.00" } },
  };
}

export function encodePaymentRequired(req: PaymentRequired): string {
  return Buffer.from(JSON.stringify(req)).toString("base64");
}

export function demoPaymentSignature(req: PaymentRequired): string {
  const accepted = req.accepts[0]!;
  const payload = {
    x402Version: 2,
    accepted,
    payload: { demo: true, signer: "Desk", resource: req.resource.url },
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/** Local x402 v2 merchant: 402 until PAYMENT-SIGNATURE, then the gated memo. */
export function merchantRespond(
  signatureHeader: string | undefined,
  memo: GatedMemo,
): { status: 200 | 402; paymentRequired?: PaymentRequired; memo?: GatedMemo; receiptHash: string } {
  const req = merchantRequirement();
  if (!signatureHeader) {
    return { status: 402, paymentRequired: req, receiptHash: "" };
  }
  const expected = demoPaymentSignature(req);
  if (signatureHeader !== expected) {
    return { status: 402, paymentRequired: req, receiptHash: "" };
  }
  const receiptHash = `0x${createHash("sha256").update(signatureHeader).digest("hex")}`;
  return { status: 200, memo, receiptHash };
}
