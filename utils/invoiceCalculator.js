const num = (v) => Number(v) || 0;

const extractPercent = (rate) => {
  if (!rate || typeof rate !== "string") return 0;
  if (!rate.trim().endsWith("%")) return 0;
  return num(rate.replace("%", ""));
};

export const calculateItemBackend = (item) => {
  const quantity = num(item.quantity);
  const unitPrice = num(item.unitPrice);

  const salesValue = quantity * unitPrice;

  const percent = extractPercent(item.rate);

  const totalItemValue =
    salesValue +
    num(item.salesTax) +
    num(item.extraTax) +
    num(item.furtherTax) +
    num(item.federalExciseDuty) +
    num(item.t236g) +
    num(item.t236h) -
    num(item.discount) -
    num(item.otherDiscount) -
    num(item.salesTaxWithheld) -
    num(item.tradeDiscount);

  return {
    ...item,
    quantity,
    unitPrice,
    salesValue,
    totalItemValue,
  };
};
