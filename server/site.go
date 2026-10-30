package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxCategories = 100

type Category struct {
	Slug      string `json:"slug"`
	Name      string `json:"name"`
	Image     string `json:"image"`
	SortOrder int    `json:"sortOrder"`
}

type Settings struct {
	Phone        string   `json:"phone"`
	WhatsApp     string   `json:"whatsapp"`
	Telegram     string   `json:"telegram"`
	Channel      string   `json:"channel"`
	Address      string   `json:"address"`
	Hours        string   `json:"hours"`
	GisURL       string   `json:"gisUrl"`
	BannerTitle  string   `json:"bannerTitle"`
	BannerText   string   `json:"bannerText"`
	BannerImages []string `json:"bannerImages"`
}

const siteSchema = `
CREATE TABLE IF NOT EXISTS categories (
	slug       TEXT PRIMARY KEY,
	name       TEXT NOT NULL,
	image      TEXT NOT NULL DEFAULT '',
	sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
	key   TEXT PRIMARY KEY,
	value JSONB NOT NULL
);`

var defaultSettings = Settings{
	Phone:        "+7 (913) 608-07-35",
	WhatsApp:     "79136080735",
	Telegram:     "+79136080735",
	Channel:      "galagarage_home",
	Address:      "Омск, улица Карла Либкнехта, 26",
	Hours:        "Ежедневно, 11:00–20:00",
	GisURL:       "https://2gis.ru/omsk/firm/70000001105982026",
	BannerTitle:  "Galagarage home",
	BannerText:   "Мебель, посуда и декор с характером. Бутик в Омске",
	BannerImages: []string{"/assets/chair-leather.jpg", "/assets/boutique.jpg", "/assets/vase-artglass.jpg"},
}

// migrateSite creates categories and settings, seeds them once and links products to categories.
func migrateSite(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	// Two instances starting at once wait for each other instead of racing on CREATE TABLE.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(7234019)`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, siteSchema); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `INSERT INTO meta (key, value) VALUES ('categories_seeded', '1') ON CONFLICT DO NOTHING`)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 1 {
		seed := []Category{
			{"decor", "Вазы и декор", "/assets/category-decor.jpg", 1},
			{"tableware", "Посуда", "/assets/category-tableware.jpg", 2},
			{"textiles", "Текстиль", "/assets/category-textiles.jpg", 3},
			{"furniture", "Мебель и свет", "/assets/category-furniture.jpg", 4},
		}
		for _, c := range seed {
			if _, err := tx.Exec(ctx, `INSERT INTO categories (slug, name, image, sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, c.Slug, c.Name, c.Image, c.SortOrder); err != nil {
				return err
			}
		}
	}
	// Any category already used by a product must exist before the foreign key is added.
	if _, err := tx.Exec(ctx, `INSERT INTO categories (slug, name, sort_order)
		SELECT DISTINCT category, category, 100 FROM products ON CONFLICT DO NOTHING`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DO $$ BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_category_fk' AND conrelid = 'products'::regclass) THEN
			ALTER TABLE products ADD CONSTRAINT products_category_fk FOREIGN KEY (category) REFERENCES categories(slug) ON DELETE RESTRICT;
		END IF;
	END $$`); err != nil {
		return err
	}
	value, _ := json.Marshal(defaultSettings)
	if _, err := tx.Exec(ctx, `INSERT INTO settings (key, value) VALUES ('site', $1) ON CONFLICT DO NOTHING`, value); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func listCategories(ctx context.Context, pool *pgxpool.Pool) ([]Category, error) {
	rows, err := pool.Query(ctx, `SELECT slug, name, image, sort_order FROM categories ORDER BY sort_order, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []Category{}
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.Slug, &c.Name, &c.Image, &c.SortOrder); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

func categoryExists(ctx context.Context, pool *pgxpool.Pool, slug string) (bool, error) {
	var exists bool
	err := pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM categories WHERE slug = $1)`, slug).Scan(&exists)
	return exists, err
}

func loadSettings(ctx context.Context, pool *pgxpool.Pool) (Settings, error) {
	var raw []byte
	err := pool.QueryRow(ctx, `SELECT value FROM settings WHERE key = 'site'`).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return defaultSettings, nil
	}
	if err != nil {
		return Settings{}, err
	}
	s := defaultSettings
	s.BannerImages = nil
	if err := json.Unmarshal(raw, &s); err != nil {
		s = defaultSettings
		s.BannerImages = nil
	}
	if len(s.BannerImages) == 0 {
		s.BannerImages = append([]string(nil), defaultSettings.BannerImages...)
	}
	return s, nil
}

var (
	digitsOnly    = regexp.MustCompile(`^\d{10,15}$`)
	telegramValue = regexp.MustCompile(`^(\+\d{10,15}|[A-Za-z][A-Za-z0-9_]{4,31})$`)
	channelValue  = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]{4,31}$`)
	phoneValue    = regexp.MustCompile(`^[+\d][\d ()\-]{9,24}$`)
	gisURL        = regexp.MustCompile(`^https://(2gis\.ru|go\.2gis\.com)/[A-Za-z0-9/._\-?=&%]*$`)
)

func cleanText(value string, max int) (string, bool) {
	value = strings.TrimSpace(value)
	return value, utf8.RuneCountInString(value) <= max
}

func cleanSettings(s *Settings) string {
	var ok bool
	s.Phone = strings.TrimSpace(s.Phone)
	s.WhatsApp = strings.TrimPrefix(strings.TrimSpace(s.WhatsApp), "+")
	s.Telegram = strings.TrimPrefix(strings.TrimSpace(s.Telegram), "@")
	s.Channel = strings.TrimPrefix(strings.TrimSpace(s.Channel), "@")
	s.GisURL = strings.TrimSpace(s.GisURL)
	switch {
	case !phoneValue.MatchString(s.Phone):
		return "Телефон: цифры, пробелы, скобки и дефис, например +7 (913) 608-07-35"
	case !digitsOnly.MatchString(s.WhatsApp):
		return "WhatsApp: номер только цифрами, например 79136080735"
	case !telegramValue.MatchString(s.Telegram):
		return "Telegram: номер вида +79136080735 или имя пользователя без @"
	case s.Channel != "" && !channelValue.MatchString(s.Channel):
		return "Канал: имя канала без @, латиницей"
	case s.GisURL != "" && !gisURL.MatchString(s.GisURL):
		return "Ссылка 2ГИС должна начинаться с https://2gis.ru/"
	case len(s.BannerImages) != 3:
		return "Для баннера нужно ровно 3 фотографии"
	}
	if s.Address, ok = cleanText(s.Address, 200); !ok || s.Address == "" {
		return "Адрес: от 1 до 200 символов"
	}
	if s.Hours, ok = cleanText(s.Hours, 120); !ok {
		return "Часы работы: не больше 120 символов"
	}
	if s.BannerTitle, ok = cleanText(s.BannerTitle, 80); !ok || s.BannerTitle == "" {
		return "Заголовок баннера: от 1 до 80 символов"
	}
	if s.BannerText, ok = cleanText(s.BannerText, 200); !ok {
		return "Текст баннера: не больше 200 символов"
	}
	for _, image := range s.BannerImages {
		if !imagePath.MatchString(image) {
			return "Недопустимая ссылка на фотографию баннера"
		}
	}
	return ""
}

var translit = map[rune]string{
	'а': "a", 'б': "b", 'в': "v", 'г': "g", 'д': "d", 'е': "e", 'ё': "e", 'ж': "zh", 'з': "z", 'и': "i", 'й': "y",
	'к': "k", 'л': "l", 'м': "m", 'н': "n", 'о': "o", 'п': "p", 'р': "r", 'с': "s", 'т': "t", 'у': "u", 'ф': "f",
	'х': "h", 'ц': "c", 'ч': "ch", 'ш': "sh", 'щ': "sch", 'ы': "y", 'э': "e", 'ю': "yu", 'я': "ya",
}

// slugFor turns a category name into a short latin id for URLs, e.g. "Свечи и ароматы" -> "svechi-i-aromaty".
func slugFor(name string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(name) {
		switch {
		case r >= 'a' && r <= 'z' || r >= '0' && r <= '9':
			b.WriteRune(r)
			dash = false
		case translit[r] != "":
			b.WriteString(translit[r])
			dash = false
		case r == 'ь' || r == 'ъ':
		default:
			if !dash && b.Len() > 0 {
				b.WriteByte('-')
				dash = true
			}
		}
		if b.Len() >= 40 {
			break
		}
	}
	slug := strings.Trim(b.String(), "-")
	if slug == "all" {
		// "all" means the whole catalog on the storefront.
		slug = "all-items"
	}
	if slug == "" {
		buf := make([]byte, 3)
		rand.Read(buf)
		slug = "razdel-" + hex.EncodeToString(buf)
	}
	return slug
}

func (h *Handlers) categories(c *gin.Context) {
	list, err := listCategories(c, h.pool)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось загрузить разделы")
		return
	}
	c.JSON(http.StatusOK, list)
}

func bindCategory(c *gin.Context) (Category, bool) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
	var cat Category
	if err := c.ShouldBindJSON(&cat); err != nil {
		fail(c, http.StatusBadRequest, "Неверные данные формы")
		return cat, false
	}
	var ok bool
	if cat.Name, ok = cleanText(cat.Name, 60); !ok || cat.Name == "" {
		fail(c, http.StatusUnprocessableEntity, "Название раздела: от 1 до 60 символов")
		return cat, false
	}
	cat.Image = strings.TrimSpace(cat.Image)
	if cat.Image != "" && !imagePath.MatchString(cat.Image) {
		fail(c, http.StatusUnprocessableEntity, "Недопустимая ссылка на фотографию")
		return cat, false
	}
	return cat, true
}

func (h *Handlers) createCategory(c *gin.Context) {
	cat, ok := bindCategory(c)
	if !ok {
		return
	}
	var count int
	var duplicate bool
	if err := h.pool.QueryRow(c, `SELECT count(*), COALESCE(bool_or(lower(name) = lower($1)), false) FROM categories`, cat.Name).Scan(&count, &duplicate); err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось сохранить раздел")
		return
	}
	if duplicate {
		fail(c, http.StatusConflict, "Раздел с таким названием уже есть")
		return
	}
	if count >= maxCategories {
		fail(c, http.StatusUnprocessableEntity, "Разделов не может быть больше 100")
		return
	}
	base := slugFor(cat.Name)
	for attempt := 0; attempt < 20; attempt++ {
		slug := base
		if attempt > 0 {
			slug = base + "-" + strconv.Itoa(attempt+1)
		}
		tag, err := h.pool.Exec(c, `INSERT INTO categories (slug, name, image, sort_order)
			VALUES ($1, $2, $3, COALESCE((SELECT MAX(sort_order) FROM categories), 0) + 1) ON CONFLICT (slug) DO NOTHING`, slug, cat.Name, cat.Image)
		if err != nil {
			fail(c, http.StatusInternalServerError, "Не удалось сохранить раздел")
			return
		}
		if tag.RowsAffected() == 1 {
			cat.Slug = slug
			c.JSON(http.StatusCreated, cat)
			return
		}
	}
	fail(c, http.StatusConflict, "Раздел с похожим названием уже есть")
}

func (h *Handlers) updateCategory(c *gin.Context) {
	cat, ok := bindCategory(c)
	if !ok {
		return
	}
	tag, err := h.pool.Exec(c, `UPDATE categories SET name = $2, image = $3 WHERE slug = $1`, c.Param("slug"), cat.Name, cat.Image)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось сохранить раздел")
		return
	}
	if tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Раздел не найден")
		return
	}
	cat.Slug = c.Param("slug")
	c.JSON(http.StatusOK, cat)
}

func (h *Handlers) deleteCategory(c *gin.Context) {
	tag, err := h.pool.Exec(c, `DELETE FROM categories WHERE slug = $1`, c.Param("slug"))
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		fail(c, http.StatusConflict, "В разделе есть товары. Перенесите их в другой раздел или удалите, затем удалите раздел")
		return
	}
	if err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось удалить раздел")
		return
	}
	if tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "Раздел не найден")
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handlers) orderCategories(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16<<10)
	var body struct {
		Slugs []string `json:"slugs"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Slugs) == 0 || len(body.Slugs) > maxCategories {
		fail(c, http.StatusBadRequest, "Неверный порядок разделов")
		return
	}
	seen := map[string]bool{}
	for _, slug := range body.Slugs {
		if seen[slug] {
			fail(c, http.StatusBadRequest, "Неверный порядок разделов")
			return
		}
		seen[slug] = true
	}
	// One statement, applied only when the list matches the current set of categories exactly.
	tag, err := h.pool.Exec(c, `UPDATE categories c SET sort_order = o.n
		FROM unnest($1::text[]) WITH ORDINALITY AS o(slug, n)
		WHERE c.slug = o.slug AND (SELECT count(*) FROM categories) = cardinality($1::text[])`, body.Slugs)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось сохранить порядок")
		return
	}
	if int(tag.RowsAffected()) != len(body.Slugs) {
		fail(c, http.StatusConflict, "Список разделов изменился. Обновите страницу и повторите")
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handlers) settings(c *gin.Context) {
	s, err := loadSettings(c, h.pool)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось загрузить настройки")
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *Handlers) saveSettings(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 32<<10)
	var s Settings
	if err := c.ShouldBindJSON(&s); err != nil {
		fail(c, http.StatusBadRequest, "Неверные данные формы")
		return
	}
	if message := cleanSettings(&s); message != "" {
		fail(c, http.StatusUnprocessableEntity, message)
		return
	}
	value, _ := json.Marshal(s)
	if _, err := h.pool.Exec(c, `INSERT INTO settings (key, value) VALUES ('site', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, value); err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось сохранить настройки")
		return
	}
	c.JSON(http.StatusOK, s)
}

func isForeignKeyError(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}
