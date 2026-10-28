package com.interviewos.api.resume

import java.awt.Color
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO
import javax.imageio.stream.MemoryCacheImageInputStream
import javax.imageio.stream.MemoryCacheImageOutputStream
import kotlin.math.max

/** Decode and rewrite profile photos so uploaded bytes and metadata are never served back verbatim. */
internal object AvatarImage {
    data class Normalised(
        val bytes: ByteArray,
        val contentType: String,
    )

    private val PNG = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
    private val JPEG = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte())
    private const val MAX_EDGE = 16_384
    private const val MAX_PIXELS = 100_000_000L
    private const val OUTPUT_EDGE = 512

    fun normalise(
        contentType: String,
        bytes: ByteArray,
    ): Normalised? {
        val format =
            when (contentType.substringBefore(';').trim().lowercase()) {
                "image/png" -> "png".takeIf { bytes.startsWith(PNG) }
                "image/jpeg" -> "jpeg".takeIf { bytes.startsWith(JPEG) }
                else -> null
            } ?: return null
        return runCatching {
            MemoryCacheImageInputStream(ByteArrayInputStream(bytes)).use { input ->
                val readers = ImageIO.getImageReaders(input)
                if (!readers.hasNext()) return@use null
                val reader = readers.next()
                try {
                    reader.input = input
                    if (!reader.formatName.equals(format, ignoreCase = true) &&
                        !(format == "jpeg" && reader.formatName.equals("jpg", ignoreCase = true))
                    ) {
                        return@use null
                    }
                    val width = reader.getWidth(0)
                    val height = reader.getHeight(0)
                    if (width <= 0 || height <= 0 || width > MAX_EDGE || height > MAX_EDGE || width.toLong() * height > MAX_PIXELS) {
                        return@use null
                    }
                    val sample = max(1, (max(width, height) + OUTPUT_EDGE - 1) / OUTPUT_EDGE)
                    val parameters = reader.defaultReadParam.apply { setSourceSubsampling(sample, sample, 0, 0) }
                    val decoded = reader.read(0, parameters) ?: return@use null
                    val scale = minOf(1.0, OUTPUT_EDGE.toDouble() / max(decoded.width, decoded.height))
                    val output =
                        BufferedImage(
                            max(1, (decoded.width * scale).toInt()),
                            max(1, (decoded.height * scale).toInt()),
                            if (format == "png") BufferedImage.TYPE_INT_ARGB else BufferedImage.TYPE_INT_RGB,
                        )
                    val graphics = output.createGraphics()
                    try {
                        if (format == "jpeg") {
                            graphics.color = Color.WHITE
                            graphics.fillRect(0, 0, output.width, output.height)
                        }
                        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC)
                        graphics.drawImage(decoded, 0, 0, output.width, output.height, null)
                    } finally {
                        graphics.dispose()
                    }
                    val encoded = ByteArrayOutputStream()
                    val writers = ImageIO.getImageWritersByFormatName(format)
                    if (!writers.hasNext()) return@use null
                    val writer = writers.next()
                    try {
                        MemoryCacheImageOutputStream(encoded).use { destination ->
                            writer.output = destination
                            writer.write(output)
                        }
                    } finally {
                        writer.dispose()
                    }
                    Normalised(encoded.toByteArray(), if (format == "png") "image/png" else "image/jpeg")
                } finally {
                    reader.dispose()
                }
            }
        }.getOrNull()
    }

    private fun ByteArray.startsWith(prefix: ByteArray): Boolean = size >= prefix.size && prefix.indices.all { this[it] == prefix[it] }
}
