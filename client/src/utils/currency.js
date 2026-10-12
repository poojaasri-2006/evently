const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2
});
export const formatAmount = amount => rupeeFormatter.format(Number(amount ?? 0));
