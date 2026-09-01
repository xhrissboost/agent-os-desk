import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPaymentRequired,
  mockSettle,
  parseBazaarEnvelope,
  paymentTrace,
  amountUsdFromAccept,
} from "../src/payments/bazaar.js";
import { B402_TESTNET_CAIP, B402_TESTNET_CHAIN_ID, DEMO_COUNTERPARTY_PAY_TO } from "../src/config.js";

const ENVELOPE = {
  code: "000000",
  message: null,
  messageDetail: null,
  success: true,
  data: {
    items: [
      {
        resource: "https://pro-api.coinmarketcap.com/x402/v3/cryptocurrency/quotes/latest",
        type: "http",
        x402Version: 2,
        description: "CMC quotes",
        accepts: [
          {
            scheme: "eip3009",
            network: "eip155:56",
            asset: "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d",
            maxAmountRequired: "10000000000000000",
            payTo: "0x3C5f3a6cE224BB89D72f5EB4232ecC27F67B3eeA",
          },
        ],
      },
    ],
  },
};

describe("payment trace", () => {
  it("parses the B402 bazaar envelope", () => {
    const items = parseBazaarEnvelope(ENVELOPE);
    assert.equal(items.length, 1);
    assert.match(items[0]!.resource, /coinmarketcap/);
    assert.equal(items[0]!.accepts[0]!.network, "eip155:56");
    const usd = amountUsdFromAccept(items[0]!.accepts[0]!);
    assert.equal(usd, 0.01);
    assert.ok(usd != null && usd <= 1);
  });

  it("remaps settlement to BSC testnet and mock-pays Desk → Counterparty", () => {
    const picked = parseBazaarEnvelope(ENVELOPE)[0]!;
    const req = buildPaymentRequired(picked, {
      description: "Agent-to-agent signal receipt",
    });
    assert.equal(req.x402Version, 2);
    assert.equal(req.accepts[0]!.network, B402_TESTNET_CAIP);
    assert.equal(req.accepts[0]!.payTo, DEMO_COUNTERPARTY_PAY_TO);
    assert.equal(req.accepts[0]!.extra.settlement, "local-mock");

    const receipt = mockSettle(req);
    assert.equal(receipt.settlement, "mock");
    assert.equal(receipt.chainId, B402_TESTNET_CHAIN_ID);
    assert.equal(receipt.payer, "Desk");
    assert.equal(receipt.payee, "Counterparty");
    assert.ok(receipt.amountUsd <= 1);
    assert.match(receipt.txHash, /^0x[0-9a-f]{64}$/);

    const trace = paymentTrace(req, receipt);
    assert.equal(trace[0]!.status, 200);
    assert.ok(trace.some((s) => s.status === 402));
  });

  it("parses search envelopes that nest resources[]", () => {
    const items = parseBazaarEnvelope({
      code: "000000",
      data: { resources: ENVELOPE.data.items },
    });
    assert.equal(items.length, 1);
  });
});
