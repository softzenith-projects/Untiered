package com.interviewos.api.resume

import org.junit.jupiter.api.Test
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AvatarImageTest {
    @Test
    fun `valid photo is decoded resized and rewritten`() {
        val original = BufferedImage(800, 400, BufferedImage.TYPE_INT_RGB)
        original.createGraphics().apply {
            color = Color.BLUE
            fillRect(0, 0, 800, 400)
            dispose()
        }
        val bytes = ByteArrayOutputStream().also { ImageIO.write(original, "png", it) }.toByteArray()

        val result = assertNotNull(AvatarImage.normalise("image/png", bytes))

        assertEquals("image/png", result.contentType)
        assertTrue(result.bytes.isNotEmpty())
        val decoded = assertNotNull(ImageIO.read(result.bytes.inputStream()))
        assertTrue(decoded.width <= 512)
        assertTrue(decoded.height <= 512)
    }

    @Test
    fun `svg and mismatched or corrupt bytes are refused`() {
        assertNull(AvatarImage.normalise("image/svg+xml", "<svg/>".toByteArray()))
        assertNull(AvatarImage.normalise("image/png", "<html>not an image</html>".toByteArray()))
        assertNull(AvatarImage.normalise("image/jpeg", ByteArray(10)))
    }
}
