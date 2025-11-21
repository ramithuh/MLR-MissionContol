# Cloudflare Tunnel Setup Guide

This guide explains how to securely expose MLR Mission Control to the internet using Cloudflare Tunnel with Cloudflare Access for authentication.

## Architecture

```
Internet → Cloudflare Edge → Cloudflare Tunnel → localhost:5173 (Frontend)
                                               → localhost:8028 (Backend API)
```

**Benefits:**
- No ports exposed to the internet
- DDoS protection via Cloudflare
- Built-in authentication with Cloudflare Access
- Free SSL/TLS certificates
- Rate limiting and security features

## Prerequisites

1. A domain managed by Cloudflare (e.g., `ramith.io`)
2. Cloudflare account (free tier works)
3. `cloudflared` CLI installed

## Installation

### Install cloudflared

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux (Debian/Ubuntu)
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Or download directly
curl -L --output cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

### Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser window to authenticate and select your domain.

## Create and Configure Tunnel

### 1. Create a new tunnel

```bash
cloudflared tunnel create mlr-mission-control
```

This creates a tunnel and saves credentials to `~/.cloudflared/`.

Note the **Tunnel ID** from the output - you'll need it.

### 2. Create tunnel configuration

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <YOUR-TUNNEL-ID>
credentials-file: /home/<your-username>/.cloudflared/<YOUR-TUNNEL-ID>.json

ingress:
  # Frontend
  - hostname: mlr.ramith.io
    service: http://localhost:5173

  # Backend API
  - hostname: api.mlr.ramith.io
    service: http://localhost:8028

  # Catch-all rule (required)
  - service: http_status:404
```

**Important:** Replace:
- `<YOUR-TUNNEL-ID>` with the tunnel ID from step 1
- `<your-username>` with your actual username
- `mlr.ramith.io` with your domain
- `api.mlr.ramith.io` with your API subdomain

### 3. Create DNS records

Route your domains to the tunnel:

```bash
cloudflared tunnel route dns mlr-mission-control mlr.ramith.io
cloudflared tunnel route dns mlr-mission-control api.mlr.ramith.io
```

Or manually in Cloudflare Dashboard:
1. Go to DNS settings
2. Add CNAME records:
   - Name: `mlr` → Target: `<TUNNEL-ID>.cfargotunnel.com`
   - Name: `api.mlr` → Target: `<TUNNEL-ID>.cfargotunnel.com`

## Run the Tunnel

### Start tunnel manually

```bash
cloudflared tunnel run mlr-mission-control
```

### Run as system service (recommended)

```bash
# Install as service
sudo cloudflared service install

# Start service
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared
```

## Set Up Cloudflare Access (Authentication)

Protect your application with authentication.

### 1. Navigate to Cloudflare Zero Trust Dashboard

1. Go to https://one.dash.cloudflare.com/
2. Select your account
3. Go to **Access** → **Applications**

### 2. Create Access Application

Click **Add an application** → **Self-hosted**

**Application configuration:**
- **Application name:** MLR Mission Control
- **Session Duration:** 24 hours (or your preference)
- **Application domain:**
  - `mlr.ramith.io`
  - `api.mlr.ramith.io`

### 3. Configure Authentication Policy

**Policy name:** Allow Authorized Users

**Configure rules:**

Option A - **Email-based:**
```
Include:
  - Emails ending in: @yourdomain.com
  - Or specific emails: your.email@gmail.com
```

Option B - **GitHub OAuth:**
```
Include:
  - GitHub organization: your-org-name
  - Or GitHub username: your-username
```

Option C - **One-time PIN:**
```
Include:
  - Emails: your.email@gmail.com
Action: Allow
Login methods: One-time PIN
```

### 4. Additional Security Settings

**Optional but recommended:**

- **Enable App Launcher:** On (shows all your protected apps)
- **CORS Settings:** Add if you have CORS issues
- **Cookie Settings:**
  - Same Site: `Lax`
  - HTTP Only: On
  - Secure: On

### 5. Save and Test

1. Click **Save application**
2. Visit `https://mlr.ramith.io`
3. You should see Cloudflare Access login page
4. Authenticate and verify access

## Application Configuration

The application is already configured to work with Cloudflare Tunnel:

**Frontend (`frontend/src/services/api.js`):**
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
```

**In production:**
- Frontend: `https://mlr.ramith.io` → serves from Vite dev server
- API calls: `https://mlr.ramith.io/api` → proxied to `https://api.mlr.ramith.io`

**Vite proxy** (`frontend/vite.config.js`):
```javascript
proxy: {
  '/api': {
    target: 'https://api.ramith.io',  // For production
    changeOrigin: true,
  }
}
```

## Running the Full Stack

### Development (local)

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8028

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Cloudflare Tunnel
cloudflared tunnel run mlr-mission-control
```

### Production

Same as above, but:
- Backend runs on localhost:8028 (not exposed)
- Frontend runs on localhost:5173 (not exposed)
- Only Cloudflare Tunnel is exposed to internet
- All traffic goes through Cloudflare Access authentication

## Troubleshooting

### Tunnel won't start

```bash
# Check tunnel status
cloudflared tunnel info mlr-mission-control

# Check tunnel list
cloudflared tunnel list

# View logs
sudo journalctl -u cloudflared -f
```

### DNS not resolving

- Wait 5-10 minutes for DNS propagation
- Check DNS records in Cloudflare dashboard
- Verify CNAME target is `<TUNNEL-ID>.cfargotunnel.com`

### Access denied / Redirect loop

- Clear browser cookies
- Check Access policy includes your email/identity
- Verify both domains are in Access application config

### API calls failing (CORS)

Add to Cloudflare Access application settings:
- CORS → Allow credentials: On
- CORS → Allow all origins or specify your frontend domain

### 502 Bad Gateway

- Backend not running on localhost:8028
- Check backend logs
- Verify tunnel config points to correct ports

## Security Best Practices

1. **Enable Cloudflare Access** on both domains
2. **Use restrictive policies** - only allow your email/org
3. **Enable 2FA** on your Cloudflare account
4. **Monitor Access logs** regularly
5. **Set short session durations** for sensitive operations
6. **Use Cloudflare WAF rules** for additional protection
7. **Keep cloudflared updated**: `cloudflared update`

## Cost

- **Cloudflare Tunnel:** Free
- **Cloudflare Access:**
  - Free tier: 50 users
  - Pro: $3/user/month (if you need more)

## Alternative: Cloudflare Tunnel via Dashboard

You can also configure tunnels via the Cloudflare Zero Trust dashboard:

1. Go to **Networks** → **Tunnels**
2. Click **Create a tunnel**
3. Choose **Cloudflared**
4. Follow the UI wizard (easier for beginners)

## References

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Cloudflare Access Docs](https://developers.cloudflare.com/cloudflare-one/applications/)
- [cloudflared GitHub](https://github.com/cloudflare/cloudflared)
