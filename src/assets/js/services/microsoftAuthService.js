/**
 * RXCORP Launcher - Modern Microsoft Authentication Service
 * Implements Device Code Flow (OAuth 2.0 RFC 8628) with QR Code & Browser Link
 * Allows 1-click login on PC default browser or instant QR code scan on mobile
 */

const QRCode = require('qrcode');
const { shell, clipboard } = require('electron');
const crypto = require('crypto');

class MicrosoftAuthService {
    constructor() {
        // Public client ID configured for Minecraft / Xbox Live Device Code Flow
        this.clientId = 'c36a9fb6-4f2a-41ff-90bd-ae7cc92031eb';
        this.activePolling = false;
        this.abortController = null;
    }

    /**
     * Start device code flow
     * Requests code from Microsoft and generates QR code
     */
    async startDeviceFlow() {
        this.cancelFlow();
        this.abortController = new AbortController();

        const tokenUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode';
        const params = new URLSearchParams({
            client_id: this.clientId,
            scope: 'XboxLive.signin offline_access'
        });

        const res = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
            signal: this.abortController.signal
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Erreur initialisation Microsoft (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const verificationUrlWithCode = `https://www.microsoft.com/link?otc=${data.user_code}`;

        // Generate QR code data URL (offline, high contrast, clean margin)
        const qrDataUrl = await QRCode.toDataURL(verificationUrlWithCode, {
            width: 200,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        // Copy code to clipboard automatically for PC convenience
        try {
            clipboard.writeText(data.user_code);
        } catch (e) {}

        return {
            userCode: data.user_code,
            deviceCode: data.device_code,
            verificationUri: data.verification_uri || 'https://www.microsoft.com/link',
            verificationUrlWithCode,
            qrDataUrl,
            expiresIn: data.expires_in || 900,
            interval: Math.max(3, data.interval || 5)
        };
    }

    /**
     * Poll Microsoft token endpoint until user approves on phone or in browser
     * @param {string} deviceCode
     * @param {number} intervalSeconds
     * @param {Function} onStatusUpdate (e.g. 'pending' | 'slow_down')
     */
    async pollForApproval(deviceCode, intervalSeconds = 5, onStatusUpdate = null) {
        this.activePolling = true;
        let pollInterval = Math.max(3, intervalSeconds) * 1000;
        const tokenUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';

        while (this.activePolling) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            if (!this.activePolling) break;

            try {
                const params = new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                    client_id: this.clientId,
                    device_code: deviceCode
                });

                const res = await fetch(tokenUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params,
                    signal: this.abortController?.signal
                });

                const data = await res.json();

                if (data.error) {
                    if (data.error === 'authorization_pending') {
                        if (onStatusUpdate) onStatusUpdate('pending');
                        continue;
                    } else if (data.error === 'slow_down') {
                        pollInterval += 3000;
                        if (onStatusUpdate) onStatusUpdate('slow_down');
                        continue;
                    } else if (data.error === 'expired_token') {
                        throw new Error('Le code de connexion a expire. Veuillez recommencer.');
                    } else {
                        throw new Error(`Erreur Microsoft OAuth: ${data.error_description || data.error}`);
                    }
                }

                if (data.access_token) {
                    this.activePolling = false;
                    // Exchange Microsoft Token for Minecraft Account
                    return await this.exchangeForMinecraftAccount(data);
                }
            } catch (err) {
                if (err.name === 'AbortError' || !this.activePolling) {
                    return null;
                }
                throw err;
            }
        }

        return null;
    }

    /**
     * Complete Xbox Live & Minecraft API exchange
     */
    async exchangeForMinecraftAccount(oauthData) {
        // 1. Xbox Live User Authentication
        const xblRes = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                Properties: {
                    AuthMethod: 'RPS',
                    SiteName: 'user.auth.xboxlive.com',
                    RpsTicket: `d=${oauthData.access_token}`
                },
                RelyingParty: 'http://auth.xboxlive.com',
                TokenType: 'JWT'
            })
        });

        const xbl = await xblRes.json();
        if (!xbl.Token || !xbl.DisplayClaims?.xui?.[0]?.uhs) {
            throw new Error('Echec authentification Xbox Live');
        }

        const uhs = xbl.DisplayClaims.xui[0].uhs;
        const xblToken = xbl.Token;

        // 2. XSTS Security Token
        const xstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                Properties: {
                    SandboxId: 'RETAIL',
                    UserTokens: [xblToken]
                },
                RelyingParty: 'rp://api.minecraftservices.com/',
                TokenType: 'JWT'
            })
        });

        const xsts = await xstsRes.json();
        if (!xsts.Token) {
            if (xsts.XErr === 2148916233) {
                throw new Error('Ce compte Microsoft ne possede pas de compte Xbox Live.');
            } else if (xsts.XErr === 2148916238) {
                throw new Error('Compte enfant Microsoft : autorisation parentale requise.');
            }
            throw new Error(`Echec autorisation XSTS (Code ${xsts.XErr || 'inconnu'})`);
        }

        const xstsToken = xsts.Token;

        // 3. Minecraft Services Login
        const mcLoginRes = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                identityToken: `XBL3.0 x=${uhs};${xstsToken}`
            })
        });

        const mcLogin = await mcLoginRes.json();
        if (!mcLogin.access_token) {
            throw new Error('Echec de la connexion aux services Minecraft');
        }

        // 4. Fetch Minecraft Player Profile
        const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
            headers: { 'Authorization': `Bearer ${mcLogin.access_token}` }
        });

        const profile = await profileRes.json();
        if (!profile.id || !profile.name) {
            throw new Error('Ce compte Microsoft ne possede pas le jeu Minecraft Java Edition.');
        }

        return {
            name: profile.name,
            uuid: profile.id,
            access_token: mcLogin.access_token,
            client_token: crypto.randomUUID(),
            user_properties: '{}',
            profile: {
                skins: profile.skins || [],
                capes: profile.capes || []
            },
            meta: {
                type: 'Microsoft',
                online: true,
                refresh_token: oauthData.refresh_token,
                access_token_expires_in: Date.now() + ((mcLogin.expires_in || 86400) * 1000)
            }
        };
    }

    /**
     * Cancel ongoing polling
     */
    cancelFlow() {
        this.activePolling = false;
        if (this.abortController) {
            try {
                this.abortController.abort();
            } catch (e) {}
            this.abortController = null;
        }
    }
}

const microsoftAuthService = new MicrosoftAuthService();
module.exports = microsoftAuthService;
