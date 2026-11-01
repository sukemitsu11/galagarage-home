package main

import (
	"context"
	"encoding/json"
	"html"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

const siteName = "Galagarage home"

var (
	seoPathValue = regexp.MustCompile(`^/[a-z0-9/_-]{0,200}$`)
	hostValue    = regexp.MustCompile(`^[A-Za-z0-9.-]{1,253}(:[0-9]{1,5})?$`)
)

// seoPage is everything a search engine or a link preview needs to know about one address.
type seoPage struct {
	Title       string
	Description string
	Path        string // canonical path, e.g. /product/vaza-mushroom
	Image       string // path of the preview photo
	Kind        string // og:type
	NoIndex     bool
	Data        []any // schema.org objects
}

// baseURL is the public address of the site without a trailing slash. PUBLIC_URL wins; otherwise it is
// taken from the request, which only ever affects the answer to the visitor who sent that request.
func (h *Handlers) baseURL(c *gin.Context) string {
	if h.publicURL != "" {
		return h.publicURL
	}
	host := c.Request.Host
	if !hostValue.MatchString(host) {
		host = "localhost"
	}
	scheme := "http"
	if c.GetHeader("X-Forwarded-Proto") == "https" || c.Request.TLS != nil {
		scheme = "https"
	}
	return scheme + "://" + host
}

// shorten collapses whitespace and cuts the text to at most limit characters.
func shorten(text string, limit int) string {
	text = strings.Join(strings.Fields(text), " ")
	if utf8.RuneCountInString(text) <= limit {
		return text
	}
	runes := []rune(text)[:limit]
	return strings.TrimRight(string(runes), " ,.;:-") + "…"
}

// sentences joins parts into one text, one full stop after each.
func sentences(parts ...string) string {
	var out []string
	for _, part := range parts {
		if part = strings.TrimRight(strings.TrimSpace(part), ". "); part != "" {
			out = append(out, part)
		}
	}
	if len(out) == 0 {
		return ""
	}
	return strings.Join(out, ". ") + "."
}

func breadcrumbs(base string, items ...[2]string) map[string]any {
	list := make([]any, 0, len(items))
	for i, item := range items {
		list = append(list, map[string]any{"@type": "ListItem", "position": i + 1, "name": item[0], "item": base + item[1]})
	}
	return map[string]any{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": list}
}

func (h *Handlers) homePage(ctx context.Context, base string) seoPage {
	s, err := loadSettings(ctx, h.pool)
	if err != nil {
		s = defaultSettings
	}
	images := make([]string, 0, len(s.BannerImages))
	for _, image := range s.BannerImages {
		images = append(images, base+image)
	}
	street, locality := s.Address, ""
	if rest, ok := strings.CutPrefix(s.Address, "Омск,"); ok {
		street, locality = strings.TrimSpace(rest), "Омск"
	}
	store := map[string]any{
		"@context": "https://schema.org", "@type": "HomeGoodsStore", "name": siteName, "url": base + "/",
		"telephone": s.Phone, "image": images,
		"address": map[string]any{"@type": "PostalAddress", "streetAddress": street, "addressLocality": locality, "addressCountry": "RU"},
	}
	var links []string
	if s.GisURL != "" {
		links = append(links, s.GisURL)
	}
	if s.Channel != "" {
		links = append(links, "https://t.me/"+s.Channel)
	}
	if len(links) > 0 {
		store["sameAs"] = links
	}
	website := map[string]any{
		"@context": "https://schema.org", "@type": "WebSite", "name": siteName, "url": base + "/",
		"potentialAction": map[string]any{"@type": "SearchAction", "target": base + "/catalog?q={search_term_string}", "query-input": "required name=search_term_string"},
	}
	return seoPage{
		Title:       siteName + " — бутик домашнего декора в Омске",
		Description: sentences(s.BannerText, s.Address, s.Phone),
		Path:        "/", Image: s.BannerImages[0], Kind: "website", Data: []any{store, website},
	}
}

func (h *Handlers) categoryPage(ctx context.Context, base, slug string) (seoPage, bool) {
	list, err := listCategories(ctx, h.pool)
	if err != nil {
		return seoPage{}, false
	}
	for _, category := range list {
		if category.Slug == slug {
			path := "/catalog/" + slug
			return seoPage{
				Title:       category.Name + " | " + siteName,
				Description: category.Name + ": каталог бутика " + siteName + " в Омске. Цены и наличие уточняйте в WhatsApp или Telegram.",
				Path:        path, Image: category.Image, Kind: "website",
				Data: []any{breadcrumbs(base, [2]string{"Главная", "/"}, [2]string{"Каталог", "/catalog"}, [2]string{category.Name, path})},
			}, true
		}
	}
	return seoPage{}, false
}

func (h *Handlers) productPage(ctx context.Context, base, key string) (seoPage, bool) {
	p, err := getProduct(ctx, h.pool, key, true)
	if err != nil {
		return seoPage{}, false
	}
	path := "/product/" + p.Slug
	description := shorten(p.Description, 160)
	if description == "" {
		description = p.Name + ". Бутик " + siteName + ", Омск."
	}
	images := make([]string, 0, len(p.Images))
	for _, image := range p.Images {
		images = append(images, base+image)
	}
	item := map[string]any{"@context": "https://schema.org", "@type": "Product", "name": p.Name, "description": shorten(p.Description, 5000), "sku": strconv.FormatInt(p.ID, 10)}
	if len(images) > 0 {
		item["image"] = images
	}
	if p.Color != "" {
		item["color"] = p.Color
	}
	if p.Price > 0 {
		item["offers"] = map[string]any{"@type": "Offer", "url": base + path, "price": strconv.Itoa(p.Price), "priceCurrency": "RUB", "availability": "https://schema.org/InStock"}
	}
	data := []any{item}
	crumbs := [][2]string{{"Главная", "/"}, {"Каталог", "/catalog"}}
	if list, err := listCategories(ctx, h.pool); err == nil {
		for _, category := range list {
			if category.Slug == p.Category {
				crumbs = append(crumbs, [2]string{category.Name, "/catalog/" + category.Slug})
			}
		}
	}
	crumbs = append(crumbs, [2]string{p.Name, path})
	data = append(data, breadcrumbs(base, crumbs...))
	page := seoPage{Title: p.Name + " | " + siteName, Description: description, Path: path, Kind: "product", Data: data}
	if len(p.Images) > 0 {
		page.Image = p.Images[0]
	}
	return page, true
}

// pageFor decides what to say about a storefront address. Anything unknown is kept out of search results.
func (h *Handlers) pageFor(ctx context.Context, base, path string) seoPage {
	path = strings.TrimRight(path, "/")
	if path == "" {
		return h.homePage(ctx, base)
	}
	parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
	switch {
	case path == "/catalog":
		return seoPage{
			Title:       "Каталог | " + siteName,
			Description: "Каталог бутика " + siteName + " в Омске: мебель, посуда, текстиль и декор. Цены и наличие уточняйте в WhatsApp или Telegram.",
			Path:        path, Kind: "website", Image: "/assets/category-all.jpg",
			Data: []any{breadcrumbs(base, [2]string{"Главная", "/"}, [2]string{"Каталог", "/catalog"})},
		}
	case len(parts) == 2 && parts[0] == "catalog":
		if page, ok := h.categoryPage(ctx, base, parts[1]); ok {
			return page
		}
	case len(parts) == 2 && parts[0] == "product":
		if page, ok := h.productPage(ctx, base, parts[1]); ok {
			return page
		}
	case path == "/favorites":
		return seoPage{Title: "Избранное | " + siteName, Description: "Предметы, которые вы отложили в избранное.", NoIndex: true}
	case parts[0] == "admin":
		return seoPage{Title: "Управление сайтом | " + siteName, Description: "Вход для владельцев.", NoIndex: true}
	}
	return seoPage{Title: "Страница не найдена | " + siteName, Description: "Такой страницы нет. Вернитесь в каталог.", NoIndex: true}
}

func meta(attr, name, content string) string {
	return `<meta ` + attr + `="` + name + `" content="` + html.EscapeString(content) + `">` + "\n"
}

// renderHead builds the tags that go into <head>. Every value is escaped, because paths and hosts come from visitors.
func renderHead(base string, p seoPage) string {
	var b strings.Builder
	b.WriteString("<title>" + html.EscapeString(p.Title) + "</title>\n")
	b.WriteString(meta("name", "description", p.Description))
	if p.NoIndex {
		b.WriteString(meta("name", "robots", "noindex, nofollow"))
	} else {
		b.WriteString(`<link rel="canonical" href="` + html.EscapeString(base+p.Path) + `">` + "\n")
	}
	b.WriteString(meta("property", "og:site_name", siteName))
	b.WriteString(meta("property", "og:locale", "ru_RU"))
	b.WriteString(meta("property", "og:type", p.Kind))
	b.WriteString(meta("property", "og:title", p.Title))
	b.WriteString(meta("property", "og:description", p.Description))
	if !p.NoIndex {
		b.WriteString(meta("property", "og:url", base+p.Path))
	}
	if p.Image != "" {
		b.WriteString(meta("property", "og:image", base+p.Image))
		b.WriteString(meta("name", "twitter:card", "summary_large_image"))
	}
	for _, item := range p.Data {
		// encoding/json escapes <, > and & so the data cannot close the script tag.
		if raw, err := json.Marshal(item); err == nil {
			b.WriteString(`<script type="application/ld+json">` + string(raw) + "</script>\n")
		}
	}
	return b.String()
}

// seoHead answers nginx's include for /api/seo/<storefront path>. It always answers 200 with usable tags.
func (h *Handlers) seoHead(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()
	path := c.Param("path")
	base := h.baseURL(c)
	var page seoPage
	if seoPathValue.MatchString(path) {
		page = h.pageFor(ctx, base, path)
	} else {
		page = seoPage{Title: "Страница не найдена | " + siteName, Description: "Такой страницы нет. Вернитесь в каталог.", NoIndex: true}
	}
	c.Header("Cache-Control", "no-store")
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(renderHead(base, page)))
}

func (h *Handlers) robots(c *gin.Context) {
	// /api stays open on purpose: search engines run the page scripts and need the catalog data.
	// /admin and /favorites are not listed: a robot that may not open a page never sees its noindex.
	text := "User-agent: *\nAllow: /\nDisallow: /api/admin\n\nSitemap: " + h.baseURL(c) + "/sitemap.xml\n"
	c.Header("Cache-Control", "public, max-age=3600")
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(text))
}

func (h *Handlers) sitemap(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	products, err := listProducts(ctx, h.pool, true)
	categories, err2 := listCategories(ctx, h.pool)
	if err != nil || err2 != nil {
		fail(c, http.StatusInternalServerError, "Не удалось собрать карту сайта")
		return
	}
	base := h.baseURL(c)
	used := map[string]bool{}
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n" + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n")
	add := func(path string) {
		b.WriteString("<url><loc>" + html.EscapeString(base+path) + "</loc></url>\n")
	}
	add("/")
	add("/catalog")
	for _, p := range products {
		used[p.Category] = true
	}
	for _, category := range categories {
		if used[category.Slug] {
			add("/catalog/" + category.Slug)
		}
	}
	for _, p := range products {
		if p.Slug != "" {
			add("/product/" + p.Slug)
		}
	}
	b.WriteString("</urlset>\n")
	c.Header("Cache-Control", "public, max-age=3600")
	c.Data(http.StatusOK, "application/xml; charset=utf-8", []byte(b.String()))
}
