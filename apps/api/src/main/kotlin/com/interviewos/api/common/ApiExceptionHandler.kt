package com.interviewos.api.common

import org.slf4j.Logger
import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.validation.FieldError
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.MissingServletRequestParameterException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.multipart.MaxUploadSizeExceededException
import org.springframework.web.servlet.resource.NoResourceFoundException

/**
 * Turns the exceptions controllers and services raise into the single [ApiError]
 * envelope. Security failures are handled earlier by [ApiErrorWriter]; this covers
 * everything that reaches a controller.
 */
@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(ApiException::class)
    fun handleApi(ex: ApiException): ResponseEntity<ApiError> = ResponseEntity.status(ex.status).body(ApiError(ex.code, ex.message))

    /** Bean-validation failure on a `@RequestBody`. Reports the first offending field. */
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(ex: MethodArgumentNotValidException): ResponseEntity<ApiError> {
        val field = ex.bindingResult.fieldErrors.firstOrNull()
        val message = field?.let { "${it.field}: ${describe(it)}" } ?: "The request body is invalid."
        return ResponseEntity.badRequest().body(ApiError("validation_failed", message))
    }

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleUnreadable(ex: HttpMessageNotReadableException): ResponseEntity<ApiError> =
        ResponseEntity.badRequest().body(ApiError("malformed_body", "The request body could not be read as JSON."))

    @ExceptionHandler(MissingServletRequestParameterException::class)
    fun handleMissingParameter(ex: MissingServletRequestParameterException): ResponseEntity<ApiError> =
        ResponseEntity.badRequest().body(ApiError("missing_parameter", "${ex.parameterName} is required."))

    @ExceptionHandler(MaxUploadSizeExceededException::class)
    fun handleTooLarge(ex: MaxUploadSizeExceededException): ResponseEntity<ApiError> =
        ResponseEntity
            .status(413)
            .body(ApiError("file_too_large", "That file is larger than the upload limit."))

    /** A path no controller serves. Scanners probe these constantly; it is not a defect. */
    @ExceptionHandler(NoResourceFoundException::class)
    fun handleNotFound(ex: NoResourceFoundException): ResponseEntity<ApiError> =
        ResponseEntity.status(404).body(ApiError("not_found", "There is nothing at this address."))

    /**
     * Anything that reaches here is a defect. The client still gets the same envelope
     * every other failure uses — a caller should never have to parse two error shapes,
     * and Spring's default body leaks the request path and timestamp for no benefit.
     * The detail goes to the log, where it belongs, not to the browser.
     */
    @ExceptionHandler(Exception::class)
    fun handleUnexpected(ex: Exception): ResponseEntity<ApiError> {
        log.error("Unhandled exception serving a request", ex)
        return ResponseEntity
            .status(500)
            .body(ApiError("internal_error", "Something went wrong on our side. Please try again."))
    }

    private fun describe(error: FieldError): String = error.defaultMessage ?: "is invalid"

    private companion object {
        val log: Logger = LoggerFactory.getLogger(ApiExceptionHandler::class.java)
    }
}
