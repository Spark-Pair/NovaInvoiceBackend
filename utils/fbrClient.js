import { request } from "node:https";
import { URL } from "node:url";
import Invoice from "../models/Invoice.js";

const FBR_URLS = {
  sandbox: {
    validate: "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb",
    submit: "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb",
  },
  production: {
    validate: "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata",
    submit: "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata",
  },
};

const normalizeText = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const titleCaseProvince = (province = "") =>
  normalizeText(province)
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const digitsOnly = (value) => normalizeText(value).replace(/\D/g, "");

const normalizeNtn = (value) =>
  normalizeText(value)
    .split("-")[0]
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();

const taxId = (party = {}) => {
  if (party.ntn) {
    return normalizeNtn(party.ntn);
  }

  if (party.cnic) return digitsOnly(party.cnic);
  if (party.strn) return digitsOnly(party.strn);

  return "";
};

const toDateOnly = (value) => new Date(value).toISOString().slice(0, 10);

const toFbrNumber = (value) => Number(Number(value || 0).toFixed(2));

const toFbrString = (value) => normalizeText(value);

const normalizeRate = (value) => {
  const rate = toFbrString(value);
  const percentMatch = rate.match(/^(\d+)(?:\.0+)?%$/);

  if (percentMatch) return `${percentMatch[1]}%`;

  return rate;
};

const percentRateValue = (value) => {
  const match = normalizeRate(value).match(/^(\d+(?:\.\d+)?)%$/);
  return match ? Number(match[1]) : null;
};

const isReducedRateSale = (saleType) => /reduced rate/i.test(toFbrString(saleType));

const buildFbrItemPayload = (item, scenarioId = "") => {
  const salesValue = toFbrNumber(item.salesValue);
  const exemptGoodsScenario = scenarioId === "SN006";
  const rate = exemptGoodsScenario ? "Exempt" : normalizeRate(item.rate);
  const percentage = percentRateValue(rate);
  const reducedRateSale = isReducedRateSale(item.saleType);
  const storedSalesTax = toFbrNumber(item.salesTax);
  const salesTax =
    exemptGoodsScenario
      ? 0
      :
    percentage !== null && storedSalesTax === 0 && salesValue > 0
      ? toFbrNumber((salesValue * percentage) / 100)
      : storedSalesTax;
  const extraTax = toFbrNumber(item.extraTax);
  const fixedValue = toFbrNumber(item.fixedValue);
  const furtherTax = toFbrNumber(item.furtherTax);
  const fedPayable = toFbrNumber(item.federalExciseDuty);
  const discount = toFbrNumber(item.discount);
  const calculatedTotal = toFbrNumber(
    salesValue + salesTax + extraTax + furtherTax + fedPayable - discount
  );
  const storedTotal = toFbrNumber(item.totalItemValue);
  const totalValues =
    exemptGoodsScenario
      ? salesValue
      :
    percentage !== null && storedTotal <= salesValue && calculatedTotal > 0
      ? calculatedTotal
      : storedTotal;

  const payload = {
    hsCode: toFbrString(item.hsCode),
    productDescription: toFbrString(item.description),
    rate,
    uoM: toFbrString(item.uom),
    quantity: toFbrNumber(item.quantity),
    totalValues,
    valueSalesExcludingST: salesValue,
    fixedNotifiedValueOrRetailPrice:
      reducedRateSale && fixedValue === 0 ? salesValue : fixedValue,
    salesTaxApplicable: salesTax,
    salesTaxWithheldAtSource: toFbrNumber(item.salesTaxWithheld),
    extraTax,
    furtherTax,
    sroScheduleNo: exemptGoodsScenario
      ? toFbrString(item.sroScheduleNo) || "6th Schd Table I"
      : toFbrString(item.sroScheduleNo),
    fedPayable,
    discount,
    saleType: exemptGoodsScenario ? "Exempt goods" : toFbrString(item.saleType),
    sroItemSerialNo: exemptGoodsScenario
      ? toFbrString(item.sroItemSerialNo) || "80"
      : toFbrString(item.sroItemSerialNo),
  };

  if ((reducedRateSale || exemptGoodsScenario) && payload.extraTax === 0) {
    payload.extraTax = "";
  }

  return payload;
};

const normalizeBuyerRegistrationType = (value) =>
  toFbrString(value).toLowerCase() === "registered" ? "Registered" : "Unregistered";

const parseFbrJson = (text) => {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(text.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return { raw: text };
    }
  }
};

export const maskFbrKey = (key = "") => {
  if (!key) return "";
  if (key.length <= 10) return `${key.slice(0, 2)}...${key.slice(-2)}`;
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
};

export const sanitizeFbrKeys = (keys = []) =>
  keys.map((key) => ({
    id: key._id,
    environment: key.environment,
    maskedKey: maskFbrKey(key.apiKey),
    expiryDate: key.expiryDate,
    createdAt: key.createdAt,
    updatedAt: key.updatedAt,
  }));

export const buildFbrInvoicePayload = (invoice, environment) => {
  const seller = invoice.relatedEntity;
  const buyer = invoice.buyer;
  const scenarioId =
    environment === "sandbox" ? toFbrString(invoice.fbrScenarioId) || "SN001" : "";
  const isSandboxUnregisteredBuyerScenario = scenarioId === "SN002";

  const payload = {
    invoiceType: toFbrString(invoice.documentType),
    invoiceDate: toDateOnly(invoice.date),
    sellerNTNCNIC: toFbrString(taxId(seller)),
    sellerBusinessName: toFbrString(seller.businessName),
    sellerProvince: titleCaseProvince(seller.province),
    sellerAddress: toFbrString(seller.fullAddress),
    buyerNTNCNIC: isSandboxUnregisteredBuyerScenario ? "0000000000000" : toFbrString(taxId(buyer)),
    buyerBusinessName: toFbrString(buyer.buyerName),
    buyerProvince: titleCaseProvince(buyer.province),
    buyerAddress: toFbrString(buyer.fullAddress),
    buyerRegistrationType: isSandboxUnregisteredBuyerScenario
      ? "Unregistered"
      : normalizeBuyerRegistrationType(buyer.registrationType),
    invoiceRefNo: toFbrString(invoice.referenceNumber),
    items: invoice.items.map((item) => buildFbrItemPayload(item, scenarioId)),
  };

  if (environment === "sandbox") {
    payload.scenarioId = scenarioId;
  }

  return payload;
};

export const validateFbrPayload = (payload) => {
  const errors = [];
  const isValidRegistrationNumber = (value) => /^[A-Z]?\d{6}$|^\d{7}$|^\d{13}$/.test(value);
  const isAllZeros = (value) => /^0+$/.test(value);
  const requiredHeaderFields = [
    "invoiceType",
    "invoiceDate",
    "sellerNTNCNIC",
    "sellerBusinessName",
    "sellerProvince",
    "sellerAddress",
    "buyerBusinessName",
    "buyerProvince",
    "buyerAddress",
    "buyerRegistrationType",
  ];
  const requiredItemFields = [
    "hsCode",
    "productDescription",
    "rate",
    "uoM",
    "saleType",
  ];

  requiredHeaderFields.forEach((field) => {
    if (!payload[field]) errors.push(`${field} is required`);
  });

  if (
    payload.buyerRegistrationType === "Registered" &&
    (!payload.buyerNTNCNIC || isAllZeros(payload.buyerNTNCNIC))
  ) {
    errors.push("Registered buyer must have a real FBR NTN/CNIC, not 0000000000000");
  }

  if (
    payload.buyerRegistrationType === "Registered" &&
    payload.buyerNTNCNIC &&
    !isValidRegistrationNumber(payload.buyerNTNCNIC)
  ) {
    errors.push("Buyer Registration No. must be a valid NTN, sandbox NTN, or 13 digit CNIC without special characters");
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    errors.push("At least one invoice item is required");
  } else {
    payload.items.forEach((item, index) => {
      requiredItemFields.forEach((field) => {
        if (!item[field]) errors.push(`items[${index + 1}].${field} is required`);
      });
    });
  }

  if (payload.scenarioId !== undefined && !payload.scenarioId) {
    errors.push("scenarioId is required for sandbox");
  }

  return errors;
};

export const getEntityFbrKey = (entity, environment) => {
  const key = entity.fbrApiKeys?.find((item) => item.environment === environment);

  if (!key) {
    const label = environment === "production" ? "Production" : "Sandbox";
    const error = new Error(`${label} FBR API key is not configured for this entity`);
    error.statusCode = 400;
    throw error;
  }

  if (new Date(key.expiryDate) < new Date()) {
    const error = new Error("Selected FBR API key has expired");
    error.statusCode = 400;
    throw error;
  }

  return key;
};

const postJson = ({ url, payload, apiKey }) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const endpoint = new URL(url);

    const req = request(
      {
        method: "POST",
        hostname: endpoint.hostname,
        path: `${endpoint.pathname}${endpoint.search}`,
        port: endpoint.port || 443,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      },
      (res) => {
        let text = "";

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text,
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("FBR request timed out"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });

export const callFbr = async ({ payload, apiKey, environment, action }) => {
  let response;

  try {
    response = await postJson({
      url: FBR_URLS[environment][action],
      payload,
      apiKey,
    });
  } catch (err) {
    const error = new Error(err.message || "Unable to reach FBR API");
    error.statusCode = 502;
    error.fbrResponse = {
      error: "Unable to reach FBR API",
      message: err.message,
      code: err.code,
    };
    throw error;
  }

  let data;

  data = parseFbrJson(response.text);

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `FBR request failed with HTTP ${response.status}`);
    error.statusCode = response.status >= 500 ? 502 : response.status;
    error.fbrResponse = data;
    throw error;
  }

  return data;
};

export const isFbrValid = (response) => {
  const validation = response?.validationResponse;
  if (!validation || String(validation.status).toLowerCase() !== "valid") return false;

  return (validation.invoiceStatuses || []).every(
    (item) => String(item.status).toLowerCase() === "valid"
  );
};

export const findInvoiceForFbr = (invoiceId, entityId) =>
  Invoice.findOne({ _id: invoiceId, relatedEntity: entityId })
    .populate("buyer")
    .populate("relatedEntity");
