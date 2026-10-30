package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func securityHeaders(hsts bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if hsts {
			c.Header("Strict-Transport-Security", "max-age=31536000")
		}
		securityHeadersBase(c)
	}
}

func securityHeadersBase(c *gin.Context) {
	h := c.Writer.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
	h.Set("X-Frame-Options", "DENY")
	h.Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
	c.Next()
}

// noListing serves files but not directory indexes.
type noListing struct{ fs http.FileSystem }

func (n noListing) Open(name string) (http.File, error) {
	file, err := n.fs.Open(name)
	if err != nil {
		return nil, err
	}
	if stat, err := file.Stat(); err != nil || stat.IsDir() {
		file.Close()
		return nil, os.ErrNotExist
	}
	return file, nil
}

func noStore(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.Next()
}

func main() {
	cfg := loadConfig()
	ctx := context.Background()

	pool, err := connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()
	if err := migrate(ctx, pool); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if err := migrateSite(ctx, pool); err != nil {
		log.Fatalf("migrate site: %v", err)
	}
	if cfg.SeedDemo {
		if err := seedDemo(ctx, pool); err != nil {
			log.Fatalf("seed: %v", err)
		}
	}

	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), securityHeaders(cfg.SecureCookies))
	if err := router.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		log.Fatal(err)
	}

	auth := newAuth(cfg)
	h := &Handlers{pool: pool, uploadDir: cfg.UploadDir}

	api := router.Group("/api", noStore)
	api.GET("/products", h.publicList)
	api.GET("/products/:id", h.publicGet)
	api.GET("/categories", h.categories)
	api.GET("/settings", h.settings)
	api.POST("/admin/login", auth.login)
	api.POST("/admin/logout", auth.logout)
	admin := api.Group("/admin", auth.require)
	admin.GET("/me", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	admin.GET("/products", h.adminList)
	admin.POST("/products", h.create)
	admin.PUT("/products/:id", h.update)
	admin.DELETE("/products/:id", h.remove)
	admin.POST("/upload", h.upload)
	admin.POST("/categories", h.createCategory)
	admin.PUT("/categories/:slug", h.updateCategory)
	admin.DELETE("/categories/:slug", h.deleteCategory)
	admin.POST("/categories/order", h.orderCategories)
	admin.PUT("/settings", h.saveSettings)

	uploads := router.Group("/uploads")
	uploads.Use(func(c *gin.Context) { c.Header("Cache-Control", "public, max-age=31536000, immutable"); c.Next() })
	uploads.StaticFS("/", noListing{http.Dir(cfg.UploadDir)})

	// Built frontend with a fallback to index.html for client-side routes.
	if info, err := os.Stat(cfg.DistDir); err == nil && info.IsDir() {
		index := filepath.Join(cfg.DistDir, "index.html")
		router.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path
			if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/uploads/") {
				c.JSON(http.StatusNotFound, gin.H{"error": "Не найдено"})
				return
			}
			file := filepath.Join(cfg.DistDir, filepath.FromSlash(filepath.Clean("/"+path)))
			if stat, err := os.Stat(file); err == nil && !stat.IsDir() {
				c.File(file)
				return
			}
			c.Header("Cache-Control", "no-cache")
			c.File(index)
		})
	} else {
		log.Printf("frontend build %q not found: serving the API only", cfg.DistDir)
	}

	server := &http.Server{
		Addr: cfg.Addr, Handler: router,
		ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: 60 * time.Second, IdleTimeout: 120 * time.Second,
	}
	log.Printf("Galagarage home: listening on %s", cfg.Addr)
	log.Fatal(server.ListenAndServe())
}
