import { offers } from '../data'
import { supabase } from '../lib/supabase'

const CATALOG_SELECT = `
  id, title, slug, description, country, currency, denomination,
  discount_percent, image_url, display_color, display_accent, short_label,
  gift_card_brands!inner(name, slug, logo_url, status),
  gift_card_categories!inner(name, slug, icon, color, accent, status)
`
const CATALOG_REQUEST_TIMEOUT_MS = 8000

function mapCategory(category, cards) {
  return {
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    color: category.color,
    accent: category.accent,
    count: cards.filter((card) => card.category === category.name).length,
  }
}

function mapGiftCard(record) {
  const brand = record.gift_card_brands
  const category = record.gift_card_categories
  return {
    id: record.slug,
    brand: brand.name,
    name: record.title,
    category: category.name,
    value: Number(record.denomination),
    discount: Number(record.discount_percent),
    rating: null,
    color: record.display_color || category.color,
    accent: record.display_accent || category.accent,
    logo: record.short_label || brand.name.slice(0, 1),
    currency: record.currency,
    country: record.country,
    imageUrl: record.image_url,
    description: record.description,
  }
}

export async function getPublicCatalog() {
  const [categoryResult, cardResult] = await Promise.all([
    supabase
      .from('gift_card_categories')
      .select('name, slug, icon, color, accent')
      .eq('status', 'active')
      .order('sort_order')
      .abortSignal(AbortSignal.timeout(CATALOG_REQUEST_TIMEOUT_MS)),
    supabase
      .from('gift_cards')
      .select(CATALOG_SELECT)
      .eq('status', 'active')
      .eq('gift_card_brands.status', 'active')
      .eq('gift_card_categories.status', 'active')
      .order('title')
      .abortSignal(AbortSignal.timeout(CATALOG_REQUEST_TIMEOUT_MS)),
  ])

  if (categoryResult.error) throw categoryResult.error
  if (cardResult.error) throw cardResult.error

  const giftCards = (cardResult.data || []).map(mapGiftCard)
  return {
    categories: (categoryResult.data || []).map((category) => mapCategory(category, giftCards)),
    giftCards,
    offers,
  }
}