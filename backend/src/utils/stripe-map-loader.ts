export const loadStripePriceMap = () => {
  return {
    basic: "price_basic",
    pro: "price_pro",
    enterprise: "price_enterprise",
  };
};

export const getStripePriceId = (tier: string): string => {
  const priceMap = loadStripePriceMap();
  return priceMap[tier as keyof typeof priceMap] || "price_basic";
};

export const getStripePriceAmount = (tier: string): number => {
  const amounts = {
    basic: 999, // $9.99
    pro: 2999, // $29.99
    enterprise: 9999, // $99.99
  };
  return amounts[tier as keyof typeof amounts] || 999;
};
