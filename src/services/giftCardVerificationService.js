import { supabase } from '../lib/supabase'

const HISTORY_COLUMNS = [
  'id',
  'user_id',
  'reference_id',
  'brand',
  'country',
  'currency',
  'card_type',
  'masked_card_number',
  'verification_status',
  'balance_status',
  'mock_balance',
  'card_status',
  'reason',
  'risk_status',
  'risk_flags',
  'details_verified',
  'submitted_at',
  'verified_at',
].join(', ')

const verificationLabels = {
  pending: 'PENDING',
  requires_review: 'REQUIRES REVIEW',
  verified: 'SUCCESSFUL',
  partially_verified: 'PARTIALLY VERIFIED',
  rejected: 'FAILED',
  failed: 'FAILED',
}

const balanceLabels = {
  pending: 'PENDING',
  verified: 'VERIFIED',
  failed: 'FAILED',
  not_checked: 'NOT CHECKED',
}

const cardStatusLabels = {
  pending: 'Not verified',
  active: 'Active',
  expired: 'Expired',
  invalid: 'Invalid',
  unknown: 'Not verified',
}

const riskLabels = {
  pending: 'PENDING',
  low: 'LOW RISK',
  medium: 'MEDIUM RISK',
  high: 'HIGH RISK',
}

function requireUserId(userId) {
  if (!userId) throw new Error('Sign in before saving or viewing verification records.')
}

function mapVerificationRecord(record) {
  return {
    id: record.id,
    userId: record.user_id,
    referenceId: record.reference_id,
    brand: record.brand,
    country: record.country,
    currency: record.currency,
    cardType: record.card_type,
    maskedCardNumber: record.masked_card_number,
    verificationStatus: verificationLabels[record.verification_status] || 'PENDING',
    balanceStatus: balanceLabels[record.balance_status] || 'PENDING',
    mockBalance: record.mock_balance,
    cardStatus: cardStatusLabels[record.card_status] || 'Not verified',
    reason: record.reason || '',
    riskStatus: riskLabels[record.risk_status] || 'PENDING',
    riskFlags: record.risk_flags || [],
    detailsVerified: record.details_verified,
    submittedAt: record.submitted_at,
    verifiedAt: record.verified_at,
  }
}

export async function submitGiftCardVerification({
  userId,
  referenceId,
  brand,
  country,
  currency,
  cardType,
  maskedCardNumber,
}) {
  requireUserId(userId)

  const { data, error } = await supabase
    .from('gift_card_verifications')
    .insert({
      user_id: userId,
      reference_id: referenceId,
      brand,
      country,
      currency,
      card_type: cardType,
      masked_card_number: maskedCardNumber,
      verification_status: 'pending',
      balance_status: 'pending',
      card_status: 'pending',
      risk_status: 'pending',
      mock_balance: null,
      verified_at: null,
      details_verified: false,
      risk_flags: [],
      submitted_at: new Date().toISOString(),
    })
    .select(HISTORY_COLUMNS)
    .single()

  if (error) throw error
  return mapVerificationRecord(data)
}

export async function getMyGiftCardVerifications(userId) {
  requireUserId(userId)

  const { data, error } = await supabase
    .from('gift_card_verifications')
    .select(HISTORY_COLUMNS)
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .abortSignal(AbortSignal.timeout(12000))

  if (error) throw error
  return (data || []).map(mapVerificationRecord)
}