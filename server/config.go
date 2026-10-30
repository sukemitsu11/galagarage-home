package main

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"os"
	"strings"
)

type Config struct {
	Addr           string
	DatabaseURL    string
	AdminPassword  string
	SessionSecret  []byte
	SecureCookies  bool
	UploadDir      string
	DistDir        string
	SeedDemo       bool
	TrustedProxies []string
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func loadConfig() Config {
	cfg := Config{
		Addr:          env("ADDR", ":8080"),
		DatabaseURL:   env("DATABASE_URL", "postgres://galagarage:galagarage@127.0.0.1:5432/galagarage?sslmode=disable"),
		AdminPassword: os.Getenv("ADMIN_PASSWORD"),
		SecureCookies: env("SECURE_COOKIES", "false") == "true",
		UploadDir:     env("UPLOAD_DIR", "./uploads"),
		DistDir:       env("DIST_DIR", "../dist"),
		SeedDemo:      env("SEED_DEMO", "true") == "true",
	}
	if proxies := env("TRUSTED_PROXIES", ""); proxies != "" {
		cfg.TrustedProxies = strings.Split(proxies, ",")
	}
	if len(cfg.AdminPassword) < 12 || strings.HasPrefix(cfg.AdminPassword, "change-me") {
		log.Fatal("ADMIN_PASSWORD must be at least 12 characters long and not the example value")
	}
	secret := os.Getenv("SESSION_SECRET")
	if len(secret) < 32 {
		buf := make([]byte, 32)
		if _, err := rand.Read(buf); err != nil {
			log.Fatal(err)
		}
		secret = hex.EncodeToString(buf)
		log.Print("SESSION_SECRET is not set or shorter than 32 characters: using a random one, admin sessions end on restart")
	}
	cfg.SessionSecret = []byte(secret)
	return cfg
}
