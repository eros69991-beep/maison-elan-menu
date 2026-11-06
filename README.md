# MAISON ÉLAN — QR Table Ordering System

A QR-code ordering system for a fictional modern French restaurant. Guests scan the code on their table, browse the menu, and place an order from their phone. Staff see new orders instantly on a live order board.

> Concept project. MAISON ÉLAN is not a real restaurant, and the dish photos are AI-generated.

**Live demo:** _coming soon_

## Features

**Guest menu** (`index.html`)
- Scanning a table's QR code opens the menu bound to that table (`?table=A01`)
- Menu sections with a sticky category bar that follows your scroll
- Cart with quantity controls, saved across page reloads
- Order notes, then one tap to send the order to the kitchen

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

- **Row Level Security** on every table. Guests can only *create* orders; they cannot read, change or delete any order
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

- **Order totals are calculated in the browser.** A technical user could edit the request and submit a wrong price. Fix in progress: move menu prices into the database and calculate totals server-side.
- The table number comes from the URL, so it could be changed by hand.
- There is no rate limiting on order creation.
- The menu lives in `menu-data-v36.js`; staff cannot edit it from the order board yet.

## Run locally

1. Open the folder in VS Code and start Live Server on `index.html`
2. Visit `index.html?table=A01` for the guest menu and `admin.html` for the order board
3. To connect your own Supabase project, follow [SETUP.zh-CN.md](./SETUP.zh-CN.md)
