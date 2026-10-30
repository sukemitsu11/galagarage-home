package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Spec struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type Product struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	Price       int       `json:"price"`
	Color       string    `json:"color"`
	HeightCM    *float64  `json:"heightCm"`
	WidthCM     *float64  `json:"widthCm"`
	LengthCM    *float64  `json:"lengthCm"`
	Specs       []Spec    `json:"specs"`
	Images      []string  `json:"images"`
	Published   bool      `json:"published"`
	CreatedAt   time.Time `json:"createdAt"`
}

const productColumns = `id, name, description, category, price, color, height_cm, width_cm, length_cm, specs, images, published, created_at`

const schema = `
CREATE TABLE IF NOT EXISTS products (
	id          BIGSERIAL PRIMARY KEY,
	name        TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	category    TEXT NOT NULL,
	price       INTEGER NOT NULL CHECK (price >= 0),
	color       TEXT NOT NULL DEFAULT '',
	height_cm   DOUBLE PRECISION,
	width_cm    DOUBLE PRECISION,
	length_cm   DOUBLE PRECISION,
	specs       JSONB NOT NULL DEFAULT '[]',
	images      TEXT[] NOT NULL DEFAULT '{}',
	published   BOOLEAN NOT NULL DEFAULT TRUE,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meta (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
);`

func connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	var lastErr error
	for attempt := 0; attempt < 30; attempt++ {
		if lastErr = pool.Ping(ctx); lastErr == nil {
			return pool, nil
		}
		log.Printf("waiting for database: %v", lastErr)
		time.Sleep(time.Second)
	}
	return nil, lastErr
}

func migrate(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(7234019)`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, schema); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func scanProduct(row pgx.Row) (Product, error) {
	var p Product
	var specs []byte
	err := row.Scan(&p.ID, &p.Name, &p.Description, &p.Category, &p.Price, &p.Color, &p.HeightCM, &p.WidthCM, &p.LengthCM, &specs, &p.Images, &p.Published, &p.CreatedAt)
	if err != nil {
		return p, err
	}
	if err := json.Unmarshal(specs, &p.Specs); err != nil || p.Specs == nil {
		p.Specs = []Spec{}
	}
	if p.Images == nil {
		p.Images = []string{}
	}
	return p, nil
}

func listProducts(ctx context.Context, pool *pgxpool.Pool, onlyPublished bool) ([]Product, error) {
	query := `SELECT ` + productColumns + ` FROM products`
	if onlyPublished {
		query += ` WHERE published`
	}
	query += ` ORDER BY created_at DESC, id DESC`
	rows, err := pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	products := []Product{}
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	return products, rows.Err()
}

func getProduct(ctx context.Context, pool *pgxpool.Pool, id int64, onlyPublished bool) (Product, error) {
	query := `SELECT ` + productColumns + ` FROM products WHERE id = $1`
	if onlyPublished {
		query += ` AND published`
	}
	return scanProduct(pool.QueryRow(ctx, query, id))
}

func insertProduct(ctx context.Context, pool *pgxpool.Pool, p Product) (Product, error) {
	specs, _ := json.Marshal(p.Specs)
	return scanProduct(pool.QueryRow(ctx,
		`INSERT INTO products (name, description, category, price, color, height_cm, width_cm, length_cm, specs, images, published)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING `+productColumns,
		p.Name, p.Description, p.Category, p.Price, p.Color, p.HeightCM, p.WidthCM, p.LengthCM, specs, p.Images, p.Published))
}

func updateProduct(ctx context.Context, pool *pgxpool.Pool, id int64, p Product) (Product, error) {
	specs, _ := json.Marshal(p.Specs)
	return scanProduct(pool.QueryRow(ctx,
		`UPDATE products SET name=$2, description=$3, category=$4, price=$5, color=$6, height_cm=$7, width_cm=$8, length_cm=$9, specs=$10, images=$11, published=$12
		 WHERE id=$1 RETURNING `+productColumns,
		id, p.Name, p.Description, p.Category, p.Price, p.Color, p.HeightCM, p.WidthCM, p.LengthCM, specs, p.Images, p.Published))
}

func deleteProduct(ctx context.Context, pool *pgxpool.Pool, id int64) (bool, error) {
	tag, err := pool.Exec(ctx, `DELETE FROM products WHERE id = $1`, id)
	return tag.RowsAffected() > 0, err
}

func isNotFound(err error) bool { return errors.Is(err, pgx.ErrNoRows) }

func f(v float64) *float64 { return &v }

// seedDemo adds three example products once. Owners then replace them in the admin panel.
func seedDemo(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `INSERT INTO meta (key, value) VALUES ('demo_seeded', '1') ON CONFLICT DO NOTHING`)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	demo := []Product{
		{
			Name: "Стул с кожаной обивкой", Category: "furniture", Price: 18500, Color: "Коричневый",
			Description: "Стул с мягкой обивкой из натуральной кожи и деревянными ножками. Подходит для обеденной зоны и рабочего места.",
			HeightCM:    f(82), WidthCM: f(46), LengthCM: f(52),
			Specs:  []Spec{{"Материал", "Натуральная кожа, дерево"}, {"Высота сиденья", "46 см"}},
			Images: []string{"/assets/chair-leather.jpg", "/assets/chair-detail.jpg"}, Published: true,
		},
		{
			Name: "Ваза Mushroom", Category: "decor", Price: 4000, Color: "Цветное стекло",
			Description: "Стеклянная ваза с широким округлым верхом и узкой ножкой. Можно поставить рядом с другой вазой или оставить одну.",
			HeightCM:    f(24), WidthCM: f(16), LengthCM: f(16),
			Specs:  []Spec{{"Материал", "Стекло"}},
			Images: []string{"/assets/vase-mushroom.jpg", "/assets/mushroom-detail.jpg"}, Published: true,
		},
		{
			Name: "Плед с кошками", Category: "textiles", Price: 4500, Color: "Серый",
			Description: "Плед с графичным рисунком. Подойдёт для дивана и кресла, хорошо смотрится в спокойном интерьере.",
			HeightCM:    nil, WidthCM: f(130), LengthCM: f(170),
			Specs:  []Spec{{"Материал", "Хлопок"}},
			Images: []string{"/assets/throw-second.jpg"}, Published: true,
		},
	}
	for _, p := range demo {
		specs, _ := json.Marshal(p.Specs)
		if _, err := tx.Exec(ctx,
			`INSERT INTO products (name, description, category, price, color, height_cm, width_cm, length_cm, specs, images, published)
			 SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11 WHERE EXISTS (SELECT 1 FROM categories WHERE slug = $3)`,
			p.Name, p.Description, p.Category, p.Price, p.Color, p.HeightCM, p.WidthCM, p.LengthCM, specs, p.Images, p.Published); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
