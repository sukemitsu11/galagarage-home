FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server .

FROM alpine:3.22
RUN adduser -D -u 10001 app && mkdir -p /data/uploads && chown app /data/uploads
WORKDIR /app
COPY --from=build /out/server ./server
USER app
ENV ADDR=:8080 UPLOAD_DIR=/data/uploads DIST_DIR=/nonexistent
EXPOSE 8080
CMD ["./server"]
