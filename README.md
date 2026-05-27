# Food Label App 🌮

Replaces Jolt. Runs on a Raspberry Pi connected to a Zebra label printer.
Staff use any tablet or phone on the same WiFi to print prep labels.

**Cost: $0/month** (vs Jolt's $100/month)

---

## What it does

- Staff tap a product on their iPad/tablet → expiration auto-calculates → one tap to print
- Labels show: product name, opened time, expires time
- Admin panel to manage products and shelf lives
- Pre-loaded with common Mexican restaurant items

---

## Raspberry Pi Setup

### 1. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify: `node --version` (should show v18+)

### 2. Clone the app

```bash
cd ~
git clone https://github.com/9motels/food-label-app.git
cd food-label-app
npm install
```

### 3. Connect the Zebra printer

Plug the Zebra into the Pi via USB. Verify it shows up:

```bash
ls /dev/usb/
# Should show: lp0
```

Give the app permission to write to it:

```bash
sudo usermod -a -G lp pi
# Log out and back in, or reboot
```

Test the printer with a raw ZPL command:

```bash
printf '^XA^FO50,50^A0N,50,50^FDTest Label^FS^XZ' > /dev/usb/lp0
```

If a label prints, you're good. If not, see Troubleshooting below.

### 4. Set the app to auto-start on boot

```bash
sudo cp ~/food-label-app/food-label.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable food-label
sudo systemctl start food-label
```

Check it's running:

```bash
sudo systemctl status food-label
```

### 5. Find the Pi's IP address

```bash
hostname -I
# Example output: 192.168.1.42
```

Write this down — staff will use it to access the app.
**Tip:** Set a static IP in your router's DHCP settings so this never changes.

### 6. Access the app

From any device on the same WiFi:

- **Station view (staff):** `http://192.168.1.42:3000`
- **Admin panel:** `http://192.168.1.42:3000/admin.html`

Or if mDNS is enabled on your network: `http://raspberrypi.local:3000`

---

## Label size

Default labels are designed for **2" × 2"** stock at 203 dpi.

To adjust for a different size, edit `buildZPL()` in `server.js`:
- `^PW` = print width in dots (203 dots per inch)
- `^LL` = label length in dots

Common sizes:
| Size    | PW  | LL  |
|---------|-----|-----|
| 2" × 1" | 406 | 203 |
| 2" × 2" | 406 | 406 |
| 2" × 4" | 406 | 812 |
| 4" × 2" | 812 | 406 |

---

## Troubleshooting

**Printer not printing / `/dev/usb/lp0` not found**

1. Check the USB cable is firmly connected
2. Try a different USB port on the Pi
3. Run `dmesg | grep usb` to see if the Pi detects the printer
4. If you see the printer in `dmesg` but not in `/dev/usb/`, try: `sudo modprobe usblp`

**Permission denied writing to /dev/usb/lp0**

```bash
sudo chmod 666 /dev/usb/lp0
# Or add pi to the lp group (see step 3)
```

**App won't start**

```bash
sudo journalctl -u food-label -n 50
```

**App starts but can't reach from iPad**

- Make sure iPad and Pi are on the same WiFi network
- Check the Pi's firewall: `sudo ufw status` — if active, allow port 3000:
  ```bash
  sudo ufw allow 3000
  ```

---

## Updating the app

```bash
cd ~/food-label-app
git pull
npm install
sudo systemctl restart food-label
```

---

## Ethernet (recommended)

For maximum reliability, plug the Pi directly into your router with an ethernet cable.
This eliminates any WiFi issues for the Pi-to-printer connection. Staff tablets
still use WiFi normally to reach the app.
