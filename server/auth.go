package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	cookieName    = "gg_admin"
	sessionTTL    = 12 * time.Hour
	maxLoginTries = 5
	loginWindow   = 10 * time.Minute
)

type Auth struct {
	password []byte
	secret   []byte
	secure   bool

	mu       sync.Mutex
	attempts map[string][]time.Time
}

func newAuth(cfg Config) *Auth {
	// The signing key depends on the password too, so changing the password ends every session.
	key := hmac.New(sha256.New, cfg.SessionSecret)
	key.Write([]byte(cfg.AdminPassword))
	return &Auth{password: []byte(cfg.AdminPassword), secret: key.Sum(nil), secure: cfg.SecureCookies, attempts: map[string][]time.Time{}}
}

func (a *Auth) sign(payload string) string {
	mac := hmac.New(sha256.New, a.secret)
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (a *Auth) issue() string {
	expires := strconv.FormatInt(time.Now().Add(sessionTTL).Unix(), 10)
	return expires + "." + a.sign(expires)
}

func (a *Auth) valid(token string) bool {
	expires, signature, ok := strings.Cut(token, ".")
	if !ok {
		return false
	}
	if subtle.ConstantTimeCompare([]byte(signature), []byte(a.sign(expires))) != 1 {
		return false
	}
	unix, err := strconv.ParseInt(expires, 10, 64)
	return err == nil && time.Now().Unix() < unix
}

// clientKey groups IPv6 clients by /64 so one host cannot rotate addresses to dodge the limit.
func clientKey(ip string) string {
	parsed := net.ParseIP(ip)
	if parsed == nil || parsed.To4() != nil {
		return ip
	}
	return parsed.Mask(net.CIDRMask(64, 128)).String()
}

// tooMany records a login attempt for the client and reports whether the limit is exceeded.
func (a *Auth) tooMany(client string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	cutoff := time.Now().Add(-loginWindow)
	for key, times := range a.attempts {
		if len(times) == 0 || times[len(times)-1].Before(cutoff) {
			delete(a.attempts, key)
		}
	}
	recent := a.attempts[client][:0]
	for _, at := range a.attempts[client] {
		if at.After(cutoff) {
			recent = append(recent, at)
		}
	}
	if len(recent) >= maxLoginTries {
		a.attempts[client] = recent
		return true
	}
	a.attempts[client] = append(recent, time.Now())
	return false
}

func (a *Auth) clearAttempts(client string) {
	a.mu.Lock()
	delete(a.attempts, client)
	a.mu.Unlock()
}

func (a *Auth) setCookie(c *gin.Context, value string, maxAge int) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name: cookieName, Value: value, Path: "/api", MaxAge: maxAge,
		HttpOnly: true, Secure: a.secure, SameSite: http.SameSiteStrictMode,
	})
}

func (a *Auth) login(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4<<10)
	var body struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный запрос"})
		return
	}
	client := clientKey(c.ClientIP())
	if a.tooMany(client) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Слишком много попыток. Повторите через 10 минут."})
		return
	}
	if subtle.ConstantTimeCompare(sha256Sum(body.Password), sha256Sum(string(a.password))) != 1 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный пароль"})
		return
	}
	a.clearAttempts(client)
	a.setCookie(c, a.issue(), int(sessionTTL.Seconds()))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func sha256Sum(value string) []byte {
	sum := sha256.Sum256([]byte(value))
	return sum[:]
}

func (a *Auth) logout(c *gin.Context) {
	a.setCookie(c, "", -1)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// require rejects requests without a valid session. Mutating requests must also carry a custom header,
// which a cross-site form cannot send.
func (a *Auth) require(c *gin.Context) {
	token, err := c.Cookie(cookieName)
	if err != nil || !a.valid(token) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Требуется вход"})
		return
	}
	if c.Request.Method != http.MethodGet && c.GetHeader("X-Requested-With") != "galagarage-admin" {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Запрос отклонён"})
		return
	}
	c.Next()
}
