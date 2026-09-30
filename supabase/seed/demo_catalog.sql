-- DEMO ONLY: optional sample catalog for local prototype rendering.
-- This script is separate from migrations and is never run automatically.

insert into public.gift_card_categories (name, slug, icon, color, accent, sort_order)
values
  ('Shopping', 'shopping', 'Bag', '#eee9ff', '#5b43d6', 1),
  ('Food & Dining', 'food-dining', 'Utensils', '#fff0e5', '#e87535', 2),
  ('Entertainment', 'entertainment', 'Clapperboard', '#ffe8f1', '#d84d83', 3),
  ('Travel', 'travel', 'Plane', '#e2f4f4', '#16858a', 4),
  ('Gaming', 'gaming', 'Gamepad2', '#e9edff', '#5269d8', 5),
  ('Beauty', 'beauty', 'Sparkles', '#fff1e8', '#d8914a', 6),
  ('Fashion', 'fashion', 'Shirt', '#f5e9ff', '#9a50c8', 7),
  ('Technology', 'technology', 'Laptop', '#e8f5ed', '#3c9564', 8),
  ('Subscriptions', 'subscriptions', 'PlaySquare', '#ffeceb', '#d65d58', 9)
on conflict (slug) do update
set name = excluded.name,
    icon = excluded.icon,
    color = excluded.color,
    accent = excluded.accent,
    sort_order = excluded.sort_order,
    status = 'active';

insert into public.gift_card_brands (name, slug, category, country, supported_currencies)
values
  ('Amazon', 'amazon', 'Shopping', 'India', array['INR']),
  ('Swiggy', 'swiggy', 'Food & Dining', 'India', array['INR']),
  ('Myntra', 'myntra', 'Fashion', 'India', array['INR']),
  ('BookMyShow', 'bookmyshow', 'Entertainment', 'India', array['INR']),
  ('Flipkart', 'flipkart', 'Shopping', 'India', array['INR']),
  ('Zomato', 'zomato', 'Food & Dining', 'India', array['INR']),
  ('Nykaa', 'nykaa', 'Beauty', 'India', array['INR']),
  ('Airtel', 'airtel', 'Subscriptions', 'India', array['INR']),
  ('Reliance Digital', 'reliance-digital', 'Technology', 'India', array['INR'])
on conflict (slug) do update
set name = excluded.name,
    category = excluded.category,
    country = excluded.country,
    supported_currencies = excluded.supported_currencies,
    status = 'active';

insert into public.gift_cards (
  brand_id, category_id, title, slug, description, country, currency,
  denomination, discount_percent, display_color, display_accent, short_label
)
select b.id, c.id, seed.title, seed.slug, seed.description, 'India', 'INR',
       seed.denomination, seed.discount_percent, seed.display_color,
       seed.display_accent, seed.short_label
from (values
  ('amazon', 'shopping', 'Amazon Shopping Voucher', 'amazon', 'Sample shopping gift card.', 2000, 8, '#fff5df', '#f0a500', 'a'),
  ('swiggy', 'food-dining', 'Swiggy Food Voucher', 'swiggy', 'Sample food and dining gift card.', 1000, 12, '#fff0e8', '#f36f21', 'S'),
  ('myntra', 'fashion', 'Myntra Fashion Card', 'myntra', 'Sample fashion gift card.', 2500, 10, '#fff0f7', '#e83d86', 'M'),
  ('bookmyshow', 'entertainment', 'BookMyShow Movie Pass', 'bookmyshow', 'Sample entertainment gift card.', 750, 15, '#ffe9e9', '#e51b23', 'B'),
  ('flipkart', 'shopping', 'Flipkart E-Gift Card', 'flipkart', 'Sample shopping gift card.', 1500, 7, '#eaf5ff', '#2776d2', 'F'),
  ('zomato', 'food-dining', 'Zomato Dining Credits', 'zomato', 'Sample dining gift card.', 500, 11, '#fff0ef', '#d92c2c', 'z'),
  ('nykaa', 'beauty', 'Nykaa Beauty Treat', 'nykaa', 'Sample beauty gift card.', 1200, 13, '#ffe9f2', '#e73f87', 'N'),
  ('airtel', 'subscriptions', 'Airtel Recharge Card', 'airtel', 'Sample subscription and recharge card.', 599, 5, '#ffecec', '#e02727', 'A'),
  ('reliance-digital', 'technology', 'Reliance Digital Gift Card', 'reliance-digital', 'Sample technology gift card.', 5000, 6, '#e9f6ff', '#1478be', 'R')
) as seed(brand_slug, category_slug, title, slug, description, denomination, discount_percent, display_color, display_accent, short_label)
join public.gift_card_brands b on b.slug = seed.brand_slug
join public.gift_card_categories c on c.slug = seed.category_slug
on conflict (slug) do update
set brand_id = excluded.brand_id,
    category_id = excluded.category_id,
    title = excluded.title,
    description = excluded.description,
    country = excluded.country,
    currency = excluded.currency,
    denomination = excluded.denomination,
    discount_percent = excluded.discount_percent,
    display_color = excluded.display_color,
    display_accent = excluded.display_accent,
    short_label = excluded.short_label,
    status = 'active';