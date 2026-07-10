// =============================================
// LIMONA CRM — Calculator Business Logic
// =============================================

import type { PropertyCost } from '@/types/database'

export interface CreditorWeights {
  largest: number
  middle: number
  smallest: number
}

export const DEFAULT_WEIGHTS: CreditorWeights = {
  largest: 1.3,
  middle: 1.0,
  smallest: 0.7,
}

export function sumCosts(costs: PropertyCost[] | null | undefined): number {
  if (!costs) return 0
  return costs.reduce((sum, c) => sum + (Number(c.value) || 0), 0)
}

// =============================================
// CALCULATOR 1: Debt below property value
// =============================================

export interface Calc1Input {
  valuePerSqm: number      // I - Value per lowest sqm
  totalDebt: number         // K - Total debt
  additionalCosts: number   // suma kosztów dodatkowych (taksa, prowizja, itp. — wpisane ręcznie)
}

export interface Calc1Result {
  rw: number                  // J = I * 0.9
  offerMinus30: number        // M = J * 0.7
  pcc: number                 // N = (M + K) * 0.02
  costs: number                // P = M + N + additionalCosts
  investment: number           // Q = P
  profit: number                // R = J - Q
  roi: number                    // S = R / Q
  decision: 'OK' | 'NIE'        // T
}

export function calculateBelow(input: Calc1Input): Calc1Result {
  const { valuePerSqm, totalDebt, additionalCosts } = input

  const rw = valuePerSqm * 0.9                              // J
  const offerMinus30 = rw * 0.7                              // M
  const pcc = (offerMinus30 + totalDebt) * 0.02              // N
  const costs = offerMinus30 + pcc + additionalCosts          // P
  const investment = costs                                    // Q
  const profit = rw - investment                              // R
  const roi = investment > 0 ? profit / investment : 0        // S
  const decision: 'OK' | 'NIE' = (profit >= 120000 || roi >= 0.36) ? 'OK' : 'NIE'  // T

  return { rw, offerMinus30, pcc, costs, investment, profit, roi, decision }
}

// =============================================
// CALCULATOR 2: Debt above property value (Creditors)
// =============================================

export interface Calc2Input {
  valuePerSqm: number        // I
  totalDebt: number           // K
  creditor1: number           // L
  creditor2: number           // M
  creditor3: number           // N
  ownerCoefficient: number    // R (default 0.025)
  additionalCosts: number     // suma kosztów dodatkowych
  weights?: CreditorWeights   // Configurable weights
}

export interface CreditorBreakdown {
  rawShare: number
  weight: number
  weightedShare: number
  normalizedShare: number
  offerAmount: number
}

export interface Calc2Result {
  rw: number                          // J
  creditor1Share: number              // O
  creditor2Share: number              // P
  creditor3Share: number              // Q
  offerMinus30: number                // X
  ownerOffer: number                  // V
  creditor1Offer: number              // S (weighted)
  creditor2Offer: number              // T (weighted)
  creditor3Offer: number              // U (weighted)
  creditorBreakdown: CreditorBreakdown[]
  pcc: number                         // Y
  costs: number                       // AA
  investment: number                  // AB
  profit: number                      // AC
  roi: number                         // AD
  decision: 'OK' | 'NIE'             // AE
}

function computeWeightedSplit(
  amounts: number[],
  totalDebt: number,
  pool: number,
  weights: CreditorWeights
): CreditorBreakdown[] {
  // Filter out zero-amount creditors for sorting, but keep all positions
  const indexed = amounts.map((amount, i) => ({ amount, index: i }))
  const nonZero = indexed.filter(c => c.amount > 0)

  if (nonZero.length === 0) {
    return amounts.map(() => ({
      rawShare: 0,
      weight: 1,
      weightedShare: 0,
      normalizedShare: 0,
      offerAmount: 0,
    }))
  }

  // Sort descending by amount to assign weights
  const sorted = [...nonZero].sort((a, b) => b.amount - a.amount)

  // Assign weights based on rank
  const weightMap = new Map<number, number>()
  if (sorted.length === 1) {
    weightMap.set(sorted[0].index, 1.0)
  } else if (sorted.length === 2) {
    weightMap.set(sorted[0].index, weights.largest)
    weightMap.set(sorted[1].index, weights.smallest)
  } else {
    weightMap.set(sorted[0].index, weights.largest)
    weightMap.set(sorted[1].index, weights.middle)
    weightMap.set(sorted[2].index, weights.smallest)
  }

  // Calculate weighted shares
  const breakdowns: CreditorBreakdown[] = amounts.map((amount, i) => {
    const rawShare = totalDebt > 0 ? amount / totalDebt : 0
    const weight = weightMap.get(i) ?? 0
    const weightedShare = rawShare * weight
    return {
      rawShare,
      weight,
      weightedShare,
      normalizedShare: 0,
      offerAmount: 0,
    }
  })

  // Normalize
  const totalWeighted = breakdowns.reduce((sum, b) => sum + b.weightedShare, 0)
  if (totalWeighted > 0) {
    breakdowns.forEach(b => {
      b.normalizedShare = b.weightedShare / totalWeighted
      b.offerAmount = pool * b.normalizedShare
    })
  }

  return breakdowns
}

export function calculateAbove(input: Calc2Input): Calc2Result {
  const {
    valuePerSqm,
    totalDebt,
    creditor1,
    creditor2,
    creditor3,
    ownerCoefficient,
    additionalCosts,
    weights = DEFAULT_WEIGHTS,
  } = input

  const rw = valuePerSqm * 0.9                             // J
  const creditor1Share = totalDebt > 0 ? creditor1 / totalDebt : 0  // O
  const creditor2Share = totalDebt > 0 ? creditor2 / totalDebt : 0  // P
  const creditor3Share = totalDebt > 0 ? creditor3 / totalDebt : 0  // Q

  const offerMinus30 = rw * 0.7                             // X
  const ownerOffer = offerMinus30 * ownerCoefficient        // V
  const creditorPool = offerMinus30 - ownerOffer

  // Weighted split among creditors
  const amounts = [creditor1, creditor2, creditor3]
  const creditorBreakdown = computeWeightedSplit(amounts, totalDebt, creditorPool, weights)

  const creditor1Offer = creditorBreakdown[0].offerAmount   // S
  const creditor2Offer = creditorBreakdown[1].offerAmount   // T
  const creditor3Offer = creditorBreakdown[2].offerAmount   // U

  const pcc = offerMinus30 * 0.02                           // Y
  const costs = offerMinus30 + pcc + additionalCosts         // AA
  const investment = costs                                   // AB
  const profit = rw - investment                             // AC
  const roi = investment > 0 ? profit / investment : 0       // AD
  const decision: 'OK' | 'NIE' = (profit >= 120000 || roi >= 0.36) ? 'OK' : 'NIE'  // AE

  return {
    rw,
    creditor1Share,
    creditor2Share,
    creditor3Share,
    offerMinus30,
    ownerOffer,
    creditor1Offer,
    creditor2Offer,
    creditor3Offer,
    creditorBreakdown,
    pcc,
    costs,
    investment,
    profit,
    roi,
    decision,
  }
}
