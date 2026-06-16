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

const titleCaseProvince = (province = "") =>
  province
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const taxId = (party = {}) => party.ntn || party.cnic || party.strn || "";

const toDateOnly = (value) => new Date(value).toISOString().slice(0, 10);

const toFbrNumber = (value) => Number(Number(value || 0).toFixed(2));

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
    invoiceType: invoice.documentType,
    invoiceDate: toDateOnly(invoice.date),
    sellerNTNCNIC: taxId(seller),
    sellerBusinessName: seller.businessName,
    sellerProvince: titleCaseProvince(seller.province),
    sellerAddress: seller.fullAddress,
    buyerNTNCNIC: taxId(buyer),
    buyerBusinessName: buyer.buyerName,
    buyerProvince: titleCaseProvince(buyer.province),
    buyerAddress: buyer.fullAddress,
    buyerRegistrationType: buyer.registrationType,
    invoiceRefNo: invoice.referenceNumber || "",
    items: invoice.items.map((item) => ({
      hsCode: item.hsCode,
      productDescription: item.description,
      rate: item.rate,
      uoM: item.uom,
      quantity: toFbrNumber(item.quantity),
      totalValues: toFbrNumber(item.totalItemValue),
      valueSalesExcludingST: toFbrNumber(item.salesValue),
      fixedNotifiedValueOrRetailPrice: toFbrNumber(item.fixedValue),
      salesTaxApplicable: toFbrNumber(item.salesTax),
      salesTaxWithheldAtSource: toFbrNumber(item.salesTaxWithheld),
      extraTax: toFbrNumber(item.extraTax),
      furtherTax: toFbrNumber(item.furtherTax),
      sroScheduleNo: item.sroScheduleNo || "",
      fedPayable: toFbrNumber(item.federalExciseDuty),
      discount: toFbrNumber(item.discount),
      saleType: item.saleType,
      sroItemSerialNo: item.sroItemSerialNo || "",
    })),
  };

  if (environment === "sandbox") {
    payload.scenarioId = invoice.fbrScenarioId || "SN001";
  }

  return payload;
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
