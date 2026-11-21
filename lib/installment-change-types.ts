/** Preview of an installment change (F16): amounts as decimal strings. */
export type InstallmentChangePreview = {
  pending: string; nextInstallment: string; previousInstallment: string; effectivePlan: number;
  interestBefore: string; interestAfter: string; interestDifference: string;
};
