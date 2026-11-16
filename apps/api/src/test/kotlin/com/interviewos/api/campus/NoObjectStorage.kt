package com.interviewos.api.campus

import com.interviewos.api.storage.ObjectStorage

/** Storage for database tests that never touch a logo: any call is a test bug. */
internal object NoObjectStorage : ObjectStorage {
    override fun upload(
        bucket: String,
        path: String,
        bytes: ByteArray,
        contentType: String,
    ) = error("not used")

    override fun download(
        bucket: String,
        path: String,
    ): ByteArray = error("not used")

    override fun createSignedUrl(
        bucket: String,
        path: String,
        expiresInSeconds: Int,
    ): String = error("not used")

    override fun deleteByPrefix(
        bucket: String,
        prefix: String,
    ) = error("not used")
}
