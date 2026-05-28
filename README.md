# Food Label App

Food prep label printer for Mexican restaurants — replaces Jolt ($100/month).

**Cost: $0/month** (Vercel free tier + Turso free tier)

**Stack:** Vercel (hosting) + Turso (cloud SQLite) + Zebra Browser Print (USB bridge on the tablet)

---

## Architecture

```
┌──────────────────────────────────┐
│  Vercel (HTTPS)                  │
│  - public/index.html  (station)  │
│  - public/admin.html  (admin)    │
│  - api/products.js    (CRUD)     │
└───────────────┬──────────────────┘
                │ products stored in Turso
┌───────────────▼──────────────────┐
│  Android Tablet (local WiFi)     │
│  Chrome + Zebra Browser Print    │
│  (Browser Print runs HTTPS on    │
│   localhost:9101, bridges to USB)│
└───────────────┬──────────────────┘
          USB x 2
    ┌────────────┴────────────┐
 Zebra ZD410 #1          Zebra ZD410 #2
```

---

## First-Time Setup

### 1. Create a Turso database

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

turso auth login
turso db create food-label-app
turso db show food-label-app           # copy the libsql:// URL
turso db tokens create food-label-app  # copy the auth token
```

### 2. Deploy to Vercel

```bash
cd food-label-app
npm install
npx vercel --prod
```

Choose **Other** when asked about framework preset.

### 3. Add environment variables

In the Vercel dashboard → your project → Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `TURSO_DATABASE_URL` | `libsql://food-label-app-xxxx.turso.io` |
| `TURSO_AUTH_TOKEN`   | the token from step 1 |

After adding them, redeploy: `npx vercel --prod`

The database schema and all 37 default products are created automatically on first use.

### 4. Set up the Android tablet

1. Install **Zebra Browser Print** from the Google Play Store (free, by Zebra Technologies)
2. Open the app — it starts automatically and shows "Service Running"
3. Open **Chrome** on the tablet and go to: `https://localhost:9101`
4. Tap **Advanced → Proceed to localhost** to trust the self-signed certificate — this is a one-time step
5. Navigate to your Vercel URL (e.g. `https://food-label-app.vercel.app`)
6. Add it to the home screen: Chrome menu → "Add to Home screen"

### 5. Test a print

- Connect both Zebra printers via USB to the tablet
- The green dots in the status bar should show printer names
- Tap any product → tap **🖨️ Print Label**

---

## Daily Use

**Station view** (`/`) — staff tap a product, confirm the opened/expires times, print.

**Admin view** (`/admin.html`) — add, edit, or delete products. Changes are instant.

---

## Label Format

2" × 2" at 203 dpi (ZD410 default stock).

```
┌─────────────────────┐
│  Pico de Gallo      │
├─────────────────────┤
│  Opened:  5/27 2:30p│
│  Expires: 5/30 2:30p│
├─────────────────────┤
│  See bottom label   │
│  for allergens      │
└─────────────────────┘
```

To change label size, update `^PW` and `^LL` in `buildZPL()` in `public/index.html`:

| Size    | PW  | LL  |
|---------|-----|-----|
| 2" × 1" | 406 | 203 |
| 2" × 2" | 406 | 406 |
| 2" × 4" | 406 | 812 |

---

## Printer Failover

The app calls `BrowserPrint.getLocalDevices()` and tries each USB printer in order. If Printer 1 fails, it falls back to Printer 2 automatically.

---

## Troubleshooting

**"Browser Print not running" in the status bar**
→ Open the Zebra Browser Print app on the tablet. Then visit `https://localhost:9101` in Chrome and accept the cert (if you haven't already).

**Printers show in status bar but nothing prints**
→ Check USB cables. Power-cycle the printer. Make sure the printer is not in an error state (no flashing lights).

**Products not loading**
→ Check the Vercel dashboard for function errors. Verify `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set in Vercel environment variables.

---

## Updating the app

```bash
cd food-label-app
# make changes
npx vercel --prod
```

Product data lives in Turso and is unaffected by redeployments.

---

## Development

```bash
npm install
npx vercel dev
```

Create a `.env.local` file with your Turso credentials for local API routes:

```
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
```

---

## Legacy (Raspberry Pi)

The original Pi-based version using direct USB writes (`/dev/usb/lp0`) is preserved in `server.js` and `food-label.service` for reference.
