package main

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

var imagePath = regexp.MustCompile(`^/(uploads|assets)/[A-Za-z0-9._-]{1,120}$`)

const (
	maxUploadBytes = 6 << 20
	maxImages      = 10
	maxSpecs       = 20
)

type Handlers struct {
	pool      *pgxpool.Pool
	uploadDir string
}

func fail(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}

func parseID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id < 1 {
		fail(c, http.StatusNotFound, "Товар не найден")
		return 0, false
	}
	return id, true
}

func (h *Handlers) publicList(c *gin.Context) {
	products, err := listProducts(c, h.pool, true)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось загрузить каталог")
		return
	}
	c.JSON(http.StatusOK, products)
}

func (h *Handlers) publicGet(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	product, err := getProduct(c, h.pool, id, true)
	if isNotFound(err) {
		fail(c, http.StatusNotFound, "Товар не найден")
		return
	}
	if err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось загрузить товар")
		return
	}
	c.JSON(http.StatusOK, product)
}

func (h *Handlers) adminList(c *gin.Context) {
	products, err := listProducts(c, h.pool, false)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось загрузить товары")
		return
	}
	c.JSON(http.StatusOK, products)
}

func validDimension(v *float64) bool { return v == nil || (*v > 0 && *v <= 1000) }

// clean validates and normalises the input. It returns a message for the owner when something is wrong.
func clean(p *Product) string {
	p.Name = strings.TrimSpace(p.Name)
	p.Description = strings.TrimSpace(p.Description)
	p.Color = strings.TrimSpace(p.Color)
	switch {
	case p.Name == "" || utf8.RuneCountInString(p.Name) > 120:
		return "Название: от 1 до 120 символов"
	case utf8.RuneCountInString(p.Description) > 4000:
		return "Описание: не больше 4000 символов"
	case p.Price < 0 || p.Price > 100_000_000:
		return "Цена: целое число от 0 до 100 000 000"
	case utf8.RuneCountInString(p.Color) > 40:
		return "Цвет: не больше 40 символов"
	case !validDimension(p.HeightCM) || !validDimension(p.WidthCM) || !validDimension(p.LengthCM):
		return "Размеры: числа больше 0 и не больше 1000 см"
	case len(p.Images) > maxImages:
		return "Фотографий не больше 10"
	case len(p.Specs) > maxSpecs:
		return "Характеристик не больше 20"
	}
	specs := make([]Spec, 0, len(p.Specs))
	for _, spec := range p.Specs {
		spec.Label, spec.Value = strings.TrimSpace(spec.Label), strings.TrimSpace(spec.Value)
		if spec.Label == "" && spec.Value == "" {
			continue
		}
		if spec.Label == "" || utf8.RuneCountInString(spec.Label) > 60 || utf8.RuneCountInString(spec.Value) > 200 {
			return "Характеристика: название до 60 символов, значение до 200"
		}
		specs = append(specs, spec)
	}
	p.Specs = specs
	for _, image := range p.Images {
		if !imagePath.MatchString(image) {
			return "Недопустимая ссылка на фотографию"
		}
	}
	if p.Images == nil {
		p.Images = []string{}
	}
	return ""
}

func (h *Handlers) bindProduct(c *gin.Context) (Product, bool) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)
	var p Product
	if err := c.ShouldBindJSON(&p); err != nil {
		fail(c, http.StatusBadRequest, "Неверные данные формы")
		return p, false
	}
	if message := clean(&p); message != "" {
		fail(c, http.StatusUnprocessableEntity, message)
		return p, false
	}
	exists, err := categoryExists(c, h.pool, p.Category)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось проверить раздел")
		return p, false
	}
	if !exists {
		fail(c, http.StatusUnprocessableEntity, "Выберите раздел из списка")
		return p, false
	}
	return p, true
}

func (h *Handlers) create(c *gin.Context) {
	p, ok := h.bindProduct(c)
	if !ok {
		return
	}
	created, err := insertProduct(c, h.pool, p)
	if isForeignKeyError(err) {
		fail(c, http.StatusUnprocessableEntity, "Выберите раздел из списка")
		return
	}
	if err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось сохранить товар")
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *Handlers) update(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	p, ok := h.bindProduct(c)
	if !ok {
		return
	}
	updated, err := updateProduct(c, h.pool, id, p)
	if isForeignKeyError(err) {
		fail(c, http.StatusUnprocessableEntity, "Выберите раздел из списка")
		return
	}
	if isNotFound(err) {
		fail(c, http.StatusNotFound, "Товар не найден")
		return
	}
	if err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось сохранить товар")
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *Handlers) remove(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	found, err := deleteProduct(c, h.pool, id)
	if err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось удалить товар")
		return
	}
	if !found {
		fail(c, http.StatusNotFound, "Товар не найден")
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

var imageTypes = map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

func (h *Handlers) upload(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadBytes+(1<<20))
	header, err := c.FormFile("file")
	if err != nil {
		fail(c, http.StatusBadRequest, "Файл не получен или больше 6 МБ")
		return
	}
	if header.Size > maxUploadBytes {
		fail(c, http.StatusRequestEntityTooLarge, "Фотография больше 6 МБ")
		return
	}
	src, err := header.Open()
	if err != nil {
		fail(c, http.StatusBadRequest, "Не удалось прочитать файл")
		return
	}
	defer src.Close()
	sniff := make([]byte, 512)
	n, _ := src.Read(sniff)
	ext, ok := imageTypes[http.DetectContentType(sniff[:n])]
	if !ok {
		fail(c, http.StatusUnsupportedMediaType, "Подходят только JPG, PNG и WebP")
		return
	}
	if _, err := src.Seek(0, 0); err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось сохранить файл")
		return
	}
	random := make([]byte, 12)
	if _, err := rand.Read(random); err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось сохранить файл")
		return
	}
	name := hex.EncodeToString(random) + ext
	if err := os.MkdirAll(h.uploadDir, 0o755); err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось сохранить файл")
		return
	}
	if err := c.SaveUploadedFile(header, filepath.Join(h.uploadDir, name)); err != nil {
		fail(c, http.StatusInternalServerError, "Не удалось сохранить файл")
		return
	}
	c.JSON(http.StatusCreated, gin.H{"url": "/uploads/" + name})
}
