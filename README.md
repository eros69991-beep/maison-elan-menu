# MAISON ÉLAN — QR Table Ordering System

A QR-code ordering system for a fictional modern French restaurant. Guests scan the code on their table, browse the menu, and place an order from their phone. Staff see new orders instantly on a live order board.

> Concept project. MAISON ÉLAN is not a real restaurant, and the dish photos are AI-generated.

**Live demo:** [maison-elan-menu.vercel.app/?table=A01](https://maison-elan-menu.vercel.app/?table=A01)

## Features

**Guest menu** (`index.html`)
- Scanning a table's QR code opens the menu bound to that table (`?table=A01`)
- Menu sections with a sticky category bar that follows your scroll
- Cart with quantity controls, saved across page reloads
- Order notes, then one tap to send the order to the kitchen
- Chinese / English toggle, remembered across visits; opens in English unless the phone is set to Chinese
- Prices in USD, loaded live from the database; sold-out items disappear from the menu

**Staff order board** (`admin.html`)
- Email and password login
- New orders appear in real time, with no page refresh
- Order flow: pending → preparing → ready → served, or cancelled
- Falls back to polling every 15 seconds if the real-time connection drops

**Demo mode**
- Without Supabase configured, the app runs fully in the browser using local storage, so you can try it with zero setup

## Tech stack

- HTML, CSS, vanilla JavaScript (no framework, no build step)
- [Supabase](https://supabase.com): Postgres database, Auth, Realtime
- Hosted as a static site

## Security

- **Prices are never trusted from the browser.** Guests send only item keys and quantities to a Postgres function, `place_order`, which looks up the real prices in `menu_items`, calculates the total, generates the order number and writes the order. Guests have no direct write access to the `orders` table
- `place_order` rejects unknown or sold-out items, invalid quantities and malformed table numbers, and limits each table to 3 orders per minute
- **Row Level Security** on every table. Guests cannot read, change or delete any order
- Only staff emails on a whitelist can read and update orders, checked inside the database by a `security definer` function
- All user-supplied text is HTML-escaped before rendering, to prevent XSS
- The Supabase publishable key in the frontend is public by design; access control is enforced by RLS, not by hiding the key

## Try the order board

| | |
| --- | --- |
| Order board | `/admin.html` |
| Email | `demo@example.com` |
| Password | _added after deployment_ |

Open `/?table=A01` on your phone, place an order, and watch it appear on the order board.

## Known limitations

- The table number comes from the URL, so someone could change it by hand. A production version would use signed, per-table QR tokens.
- Rate limiting is per table only (3 orders per minute); there is no per-device or per-IP limit.
- Prices and availability are edited in Supabase's Table Editor (`menu_items`); there is no menu editor in the order board yet. Dish photos and descriptions still live in `menu-data-v36.js`.
- The staff order board is in Chinese only.

## Run locally

1. Open the folder in VS Code and start Live Server on `index.html`
2. Visit `index.html?table=A01` for the guest menu and `admin.html` for the order board
3. To connect your own Supabase project, follow [SETUP.zh-CN.md](./SETUP.zh-CN.md): run `supabase-setup-v36.sql`, then `supabase-upgrade-v37.sql`
