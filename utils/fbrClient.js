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

const taxId = (party = {}) => {
  if (party.ntn) {
    return digitsOnly(String(party.ntn).split("-")[0]);
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

const normalizeBuyerRegistrationType = (value) =>
  toFbrString(value).toLowerCase() === "registered" ? "Registered" : "Unregistered";

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

  const payload = {
    invoiceType: toFbrString(invoice.documentType),
    invoiceDate: toDateOnly(invoice.date),
    sellerNTNCNIC: toFbrString(taxId(seller)),
    sellerBusinessName: toFbrString(seller.businessName),
    sellerProvince: titleCaseProvince(seller.province),
    sellerAddress: toFbrString(seller.fullAddress),
    buyerNTNCNIC: toFbrString(taxId(buyer)),
    buyerBusinessName: toFbrString(buyer.buyerName),
    buyerProvince: titleCaseProvince(buyer.province),
    buyerAddress: toFbrString(buyer.fullAddress),
    buyerRegistrationType: normalizeBuyerRegistrationType(buyer.registrationType),
    invoiceRefNo: toFbrString(invoice.referenceNumber),
    items: invoice.items.map((item) => ({
      hsCode: toFbrString(item.hsCode),
      productDescription: toFbrString(item.description),
      rate: normalizeRate(item.rate),
      uoM: toFbrString(item.uom),
      quantity: toFbrNumber(item.quantity),
      totalValues: toFbrNumber(item.totalItemValue),
      valueSalesExcludingST: toFbrNumber(item.salesValue),
      fixedNotifiedValueOrRetailPrice: toFbrNumber(item.fixedValue),
      salesTaxApplicable: toFbrNumber(item.salesTax),
      salesTaxWithheldAtSource: toFbrNumber(item.salesTaxWithheld),
      extraTax: toFbrNumber(item.extraTax),
      furtherTax: toFbrNumber(item.furtherTax),
      sroScheduleNo: toFbrString(item.sroScheduleNo),
      fedPayable: toFbrNumber(item.federalExciseDuty),
      discount: toFbrNumber(item.discount),
      saleType: toFbrString(item.saleType),
      sroItemSerialNo: toFbrString(item.sroItemSerialNo),
    })),
  };

  if (environment === "sandbox") {
    payload.scenarioId = toFbrString(invoice.fbrScenarioId) || "SN001";
  }

  return payload;
};

export const validateFbrPayload = (payload) => {
  const errors = [];
  const isValidTaxId = (value) => /^\d{7}$|^\d{13}$/.test(value);
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

  if (payload.sellerNTNCNIC && !isValidTaxId(payload.sellerNTNCNIC)) {
    errors.push("sellerNTNCNIC must be a 7 digit NTN or 13 digit CNIC without dashes");
  }

  if (payload.buyerNTNCNIC && !isValidTaxId(payload.buyerNTNCNIC)) {
    errors.push("buyerNTNCNIC must be a 7 digit NTN or 13 digit CNIC without dashes");
  }

  if (
    payload.buyerRegistrationType === "Registered" &&
    (!payload.buyerNTNCNIC || isAllZeros(payload.buyerNTNCNIC))
  ) {
    errors.push("Registered buyer must have a real FBR NTN/CNIC, not 0000000000000");
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

  try {
    data = response.text ? JSON.parse(response.text) : {};
  } catch {
    data = { raw: response.text };
  }

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
