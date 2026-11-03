package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

// withOrientation inserts an EXIF segment with the given orientation right after the JPEG start marker.
func withOrientation(data []byte, orientation uint16) []byte {
	tiff := []byte{'M', 'M', 0, 42, 0, 0, 0, 8, 0, 1}
	entry := make([]byte, 12)
	binary.BigEndian.PutUint16(entry[0:], 0x0112)
	binary.BigEndian.PutUint16(entry[2:], 3)
	binary.BigEndian.PutUint32(entry[4:], 1)
	binary.BigEndian.PutUint16(entry[8:], orientation)
	tiff = append(tiff, entry...)
	tiff = append(tiff, 0, 0, 0, 0)
	payload := append([]byte("Exif\x00\x00"), tiff...)
	segment := []byte{0xFF, 0xE1, 0, 0}
	binary.BigEndian.PutUint16(segment[2:], uint16(len(payload)+2))
	segment = append(segment, payload...)
	return append(append(append([]byte{}, data[:2]...), segment...), data[2:]...)
}

func decode(t *testing.T, data []byte) image.Image {
	t.Helper()
	img, err := jpeg.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	return img
}

func TestProcessImageAppliesRotationAndStripsMetadata(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 200, 100))
	for y := 0; y < 100; y++ {
		for x := 0; x < 200; x++ {
			src.Set(x, y, color.RGBA{R: 255, A: 255})
		}
	}
	var raw bytes.Buffer
	if err := jpeg.Encode(&raw, src, nil); err != nil {
		t.Fatal(err)
	}
	full, thumb, err := processImage(withOrientation(raw.Bytes(), 6))
	if err != nil {
		t.Fatal(err)
	}
	if b := decode(t, full).Bounds(); b.Dx() != 100 || b.Dy() != 200 {
		t.Fatalf("orientation 6 should turn 200x100 into 100x200, got %dx%d", b.Dx(), b.Dy())
	}
	if bytes.Contains(full, []byte("Exif")) || bytes.Contains(thumb, []byte("Exif")) {
		t.Fatal("metadata was not removed")
	}
}

func TestProcessImageShrinksAndFlattensTransparency(t *testing.T) {
	src := image.NewNRGBA(image.Rect(0, 0, 3000, 2000))
	var raw bytes.Buffer
	if err := png.Encode(&raw, src); err != nil { // fully transparent
		t.Fatal(err)
	}
	full, thumb, err := processImage(raw.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if b := decode(t, full).Bounds(); b.Dx() != fullSide || b.Dy() != fullSide*2/3 {
		t.Fatalf("full size is %dx%d", b.Dx(), b.Dy())
	}
	img := decode(t, thumb)
	if b := img.Bounds(); b.Dx() != thumbSide {
		t.Fatalf("thumb width is %d", b.Dx())
	}
	if r, g, bl, _ := img.At(10, 10).RGBA(); r>>8 < 250 || g>>8 < 250 || bl>>8 < 250 {
		t.Fatal("transparent pixels should become white")
	}
}

func TestProcessImageRejectsGarbageAndHugeImages(t *testing.T) {
	if _, _, err := processImage([]byte("not an image")); err == nil {
		t.Fatal("garbage was accepted")
	}
	huge := image.NewGray(image.Rect(0, 0, 8000, 4000)) // 32 million pixels
	var raw bytes.Buffer
	if err := png.Encode(&raw, huge); err != nil {
		t.Fatal(err)
	}
	if _, _, err := processImage(raw.Bytes()); err == nil {
		t.Fatal("an image over the pixel limit was accepted")
	}
}

func TestProductSlugAndStatusValidation(t *testing.T) {
	p := Product{Name: "Ваза", Status: "broken"}
	if clean(&p) == "" {
		t.Fatal("unknown status was accepted")
	}
	p = Product{Name: "Ваза"}
	if msg := clean(&p); msg != "" || p.Status != "" {
		t.Fatalf("empty status must stay empty so an update keeps the stored one, got %q %q", p.Status, msg)
	}
}
