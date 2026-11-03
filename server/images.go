package main

import (
	"bytes"
	"encoding/binary"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	fullSide    = 1600 // longest side of the photo shown on the product page
	thumbSide   = 600  // longest side of the tile photo in catalog lists
	// Decoding needs several bytes per pixel (a 16-bit PNG needs sixteen), so both the total and the
	// longest side are capped. A 6 MB file can still describe a huge picture.
	maxPixels   = 30_000_000
	maxSide     = 12_000
	fullQuality = 85
	thumbQual   = 82
)

var errBadImage = errors.New("unreadable image")

// processImage turns an uploaded photo into a page-sized JPEG and a smaller tile JPEG.
// Re-encoding drops all metadata (GPS position, camera model), and the EXIF rotation of phone
// photos is applied first so the picture does not end up sideways.
func processImage(data []byte) (full, thumb []byte, err error) {
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width < 1 || config.Height < 1 || config.Width > maxSide || config.Height > maxSide ||
		config.Width*config.Height > maxPixels || config.ColorModel == color.CMYKModel {
		return nil, nil, errBadImage
	}
	decoded, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, nil, errBadImage
	}
	page := render(decoded, fullSide)
	if format == "jpeg" {
		page = orient(page, jpegOrientation(data))
	}
	small := render(page, thumbSide)
	if full, err = encodeJPEG(page, fullQuality); err != nil {
		return nil, nil, err
	}
	if thumb, err = encodeJPEG(small, thumbQual); err != nil {
		return nil, nil, err
	}
	return full, thumb, nil
}

func encodeJPEG(img image.Image, quality int) ([]byte, error) {
	var out bytes.Buffer
	if err := jpeg.Encode(&out, img, &jpeg.Options{Quality: quality}); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

// render scales img down to at most side pixels on the longest edge (never up) and flattens
// transparency onto white, because JPEG has no alpha channel.
func render(img image.Image, side int) *image.RGBA {
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if longest := max(w, h); longest > side {
		w, h = max(1, w*side/longest), max(1, h*side/longest)
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	xdraw.Draw(dst, dst.Bounds(), image.White, image.Point{}, xdraw.Src)
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), img, bounds, xdraw.Over, nil)
	return dst
}

// jpegOrientation reads the EXIF orientation (1 to 8) of a JPEG, 1 when there is none.
func jpegOrientation(data []byte) int {
	if len(data) < 4 || data[0] != 0xFF || data[1] != 0xD8 {
		return 1
	}
	pos := 2
	for pos+4 <= len(data) && data[pos] == 0xFF {
		marker := data[pos+1]
		if marker == 0xDA || marker == 0xD9 {
			break
		}
		size := int(binary.BigEndian.Uint16(data[pos+2:]))
		if size < 2 || pos+2+size > len(data) {
			break
		}
		if marker == 0xE1 {
			if o := exifOrientation(data[pos+4 : pos+2+size]); o != 0 {
				return o
			}
		}
		pos += 2 + size
	}
	return 1
}

func exifOrientation(segment []byte) int {
	if len(segment) < 14 || string(segment[:6]) != "Exif\x00\x00" {
		return 0
	}
	tiff := segment[6:]
	var order binary.ByteOrder
	switch string(tiff[:2]) {
	case "II":
		order = binary.LittleEndian
	case "MM":
		order = binary.BigEndian
	default:
		return 0
	}
	ifd := int(order.Uint32(tiff[4:]))
	if ifd < 8 || ifd > len(tiff)-2 {
		return 0
	}
	count := int(order.Uint16(tiff[ifd:]))
	for i := 0; i < count; i++ {
		entry := ifd + 2 + i*12
		if entry+12 > len(tiff) {
			return 0
		}
		if order.Uint16(tiff[entry:]) == 0x0112 {
			if value := int(order.Uint16(tiff[entry+8:])); value >= 1 && value <= 8 {
				return value
			}
			return 0
		}
	}
	return 0
}

// orient applies an EXIF orientation so that the pixels are upright.
func orient(src *image.RGBA, orientation int) *image.RGBA {
	if orientation < 2 || orientation > 8 {
		return src
	}
	w, h := src.Bounds().Dx(), src.Bounds().Dy()
	dw, dh := w, h
	if orientation >= 5 {
		dw, dh = h, w
	}
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	for y := 0; y < dh; y++ {
		for x := 0; x < dw; x++ {
			var sx, sy int
			switch orientation {
			case 2:
				sx, sy = w-1-x, y
			case 3:
				sx, sy = w-1-x, h-1-y
			case 4:
				sx, sy = x, h-1-y
			case 5:
				sx, sy = y, x
			case 6:
				sx, sy = y, h-1-x
			case 7:
				sx, sy = w-1-y, h-1-x
			case 8:
				sx, sy = w-1-y, x
			}
			dst.SetRGBA(x, y, src.RGBAAt(sx, sy))
		}
	}
	return dst
}
