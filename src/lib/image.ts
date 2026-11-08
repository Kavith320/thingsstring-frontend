/**
 * Resize an image file in the browser before upload (the backend stores images as sent,
 * max 2 MB, PNG/JPEG/WebP only). Crops to a centred square when `square` is true.
 */
export async function resizeImage(file: File, maxSize: number, { square = false } = {}): Promise<Blob> {
    if (!/^image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.type)) {
        throw new Error("Please choose a PNG, JPEG or WebP image.");
    }
    const bitmap = await createImageBitmap(file);
    try {
        let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
        if (square) {
            const side = Math.min(sw, sh);
            sx = (sw - side) / 2;
            sy = (sh - side) / 2;
            sw = sh = side;
        }
        const scale = Math.min(1, maxSize / Math.max(sw, sh));
        const w = Math.max(1, Math.round(sw * scale));
        const h = Math.max(1, Math.round(sh * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Image resizing isn't supported in this browser.");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
        // WebP keeps transparency and is small; fall back to PNG where unsupported
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9));
        if (blob && blob.type === "image/webp") return blob;
        const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        if (!png) throw new Error("Couldn't process that image.");
        return png;
    } finally {
        bitmap.close();
    }
}
