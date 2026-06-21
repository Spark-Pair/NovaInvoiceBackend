import {
  buildFbrInvoicePayload,
  callFbr,
  findInvoiceForFbr,
  getEntityFbrKey,
  isFbrValid,
  sanitizeFbrKeys,
  validateFbrPayload,
} from "../utils/fbrClient.js";

const normalizeEnvironment = (environment) =>
  environment === "production" ? "production" : "sandbox";

export const getFbrSettings = async (req, res, next) => {
  try {
    res.status(200).json({
      entity: {
        id: req.entity._id,
        businessName: req.entity.businessName,
      },
      apiKeys: sanitizeFbrKeys(req.entity.fbrApiKeys || []),
    });
  } catch (err) {
    next(err);
  }
};

export const upsertFbrApiKey = async (req, res, next) => {
  try {
    const { apiKey, expiryDate } = req.body;
    const environment = normalizeEnvironment(req.body.environment);

    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ message: "FBR API key is required" });
    }

    if (!expiryDate || Number.isNaN(new Date(expiryDate).getTime())) {
      return res.status(400).json({ message: "Valid expiry date is required" });
    }

    const existingKey = req.entity.fbrApiKeys.find(
      (key) => key.environment === environment
    );

    if (existingKey) {
      existingKey.apiKey = apiKey.trim();
      existingKey.expiryDate = new Date(expiryDate);
      existingKey.updatedAt = new Date();
    } else {
      req.entity.fbrApiKeys.push({
        environment,
        apiKey: apiKey.trim(),
        expiryDate: new Date(expiryDate),
      });
    }

    await req.entity.save();

    res.status(200).json({
      message: "FBR API key saved successfully",
      apiKeys: sanitizeFbrKeys(req.entity.fbrApiKeys),
    });
  } catch (err) {
    next(err);
  }
};

export const deleteFbrApiKey = async (req, res, next) => {
  try {
    const environment = normalizeEnvironment(req.params.environment);

    req.entity.fbrApiKeys = req.entity.fbrApiKeys.filter(
      (key) => key.environment !== environment
    );
    await req.entity.save();

    res.status(200).json({
      message: "FBR API key removed successfully",
      apiKeys: sanitizeFbrKeys(req.entity.fbrApiKeys),
    });
  } catch (err) {
    next(err);
  }
};

const sendInvoiceToFbr = async ({ req, res, next, action }) => {
  let payload;

  try {
    const environment = normalizeEnvironment(req.body.environment);
    const invoice = await findInvoiceForFbr(req.params.id, req.entity._id);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (
      action === "submit" &&
      invoice.isSent &&
      invoice.fbrEnvironment === "production"
    ) {
      return res.status(400).json({
        message: "Invoice is already sent to FBR production",
      });
    }

    const key = getEntityFbrKey(req.entity, environment);

    if (environment === "sandbox" && req.body.scenarioId) {
      invoice.fbrScenarioId = req.body.scenarioId;
    }

    payload = buildFbrInvoicePayload(invoice, environment);
    const payloadErrors = validateFbrPayload(payload);

    if (payloadErrors.length) {
      return res.status(400).json({
        message: "Invoice is missing required FBR fields",
        errors: payloadErrors,
        payload,
      });
    }

    const fbrResponse = await callFbr({
      payload,
      apiKey: key.apiKey,
      environment,
      action,
    });

    const valid = isFbrValid(fbrResponse);
    invoice.fbrEnvironment = environment;
    invoice.fbrResponse = fbrResponse;

    if (action === "validate") {
      invoice.fbrStatus = valid ? "valid" : "invalid";
      invoice.fbrValidatedAt = new Date();
    } else {
      invoice.fbrStatus = valid ? "submitted" : "failed";
      invoice.fbrSubmittedAt = new Date();
      invoice.isSent = valid;
      invoice.fbrInvoiceNumber = fbrResponse.invoiceNumber || invoice.fbrInvoiceNumber;
    }

    await invoice.save();

    res.status(200).json({
      message:
        action === "validate"
          ? valid
            ? "Invoice validated by FBR"
            : "FBR returned validation errors"
          : valid
            ? "Invoice submitted to FBR"
            : "FBR rejected the invoice",
      valid,
      payload,
      fbrResponse,
      invoice: {
        id: invoice._id,
        isSent: invoice.isSent,
        fbrStatus: invoice.fbrStatus,
        fbrEnvironment: invoice.fbrEnvironment,
        fbrInvoiceNumber: invoice.fbrInvoiceNumber,
      },
    });
  } catch (err) {
    if (payload && err.fbrResponse) {
      err.fbrPayload = payload;
    }
    next(err);
  }
};

export const validateInvoiceWithFbr = (req, res, next) =>
  sendInvoiceToFbr({ req, res, next, action: "validate" });

export const submitInvoiceToFbr = (req, res, next) =>
  sendInvoiceToFbr({ req, res, next, action: "submit" });
